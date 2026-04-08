export interface JwtBodyPayload {
  type: 'Text' | 'Base64' | 'Empty';
  data?: string;
}

export interface JwtTransaction {
  id: string;
  request: {
    method: string;
    url: string;
    headers: [string, string][];
    body: JwtBodyPayload;
  };
}

export interface JwtSegmentData {
  raw: string;
  decoded: string;
  json: Record<string, unknown> | null;
  parseError: string | null;
}

export interface JwtCandidate {
  id: string;
  token: string;
  transactionId: string;
  method: string;
  url: string;
  source: 'header' | 'cookie' | 'query' | 'body';
  container: string;
  label: string;
  header: JwtSegmentData;
  payload: JwtSegmentData;
  signature: string;
  notes: string[];
}

export interface JwtBuildResult {
  token: string;
  warnings: string[];
}

const JWT_REGEX = /([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*)/g;

export function extractJwtCandidates(transactions: JwtTransaction[]): JwtCandidate[] {
  const candidates: JwtCandidate[] = [];
  const seen = new Set<string>();

  for (const transaction of transactions) {
    for (const [headerName, headerValue] of transaction.request.headers) {
      const lowerHeader = headerName.toLowerCase();
      if (lowerHeader === 'authorization') {
        const bearerMatch = headerValue.match(/Bearer\s+([A-Za-z0-9._-]+)/i);
        if (bearerMatch?.[1]) {
          pushCandidate(candidates, seen, transaction, bearerMatch[1], 'header', headerName);
          continue;
        }
      }

      if (lowerHeader === 'cookie') {
        const cookieParts = headerValue.split(';').map((part) => part.trim()).filter(Boolean);
        for (const part of cookieParts) {
          const [cookieName, ...valueParts] = part.split('=');
          const cookieValue = valueParts.join('=');
          const match = findFirstJwt(cookieValue);
          if (match) {
            pushCandidate(candidates, seen, transaction, match, 'cookie', cookieName || 'cookie');
          }
        }
      } else {
        for (const match of findJwtMatches(headerValue)) {
          pushCandidate(candidates, seen, transaction, match, 'header', headerName);
        }
      }
    }

    try {
      const parsedUrl = new URL(transaction.request.url);
      parsedUrl.searchParams.forEach((value, key) => {
        for (const match of findJwtMatches(value)) {
          pushCandidate(candidates, seen, transaction, match, 'query', key);
        }
      });
    } catch {}

    if (transaction.request.body.type === 'Text' && transaction.request.body.data) {
      for (const match of findJwtMatches(transaction.request.body.data)) {
        pushCandidate(candidates, seen, transaction, match, 'body', 'request body');
      }
    }
  }

  return candidates;
}

export function buildJwtFromDrafts(
  originalToken: string,
  headerDraft: string,
  payloadDraft: string,
): JwtBuildResult {
  const originalParts = originalToken.split('.');
  const headerObject = JSON.parse(headerDraft) as Record<string, unknown>;
  const payloadObject = JSON.parse(payloadDraft) as Record<string, unknown>;
  const headerEncoded = encodeBase64Url(JSON.stringify(headerObject, null, 0));
  const payloadEncoded = encodeBase64Url(JSON.stringify(payloadObject, null, 0));
  const signature = originalParts[2] || '';
  const token = `${headerEncoded}.${payloadEncoded}.${signature}`;
  const warnings: string[] = [];

  if (signature) {
    warnings.push('A assinatura original foi preservada. Se header/payload mudaram, a assinatura deve ficar invalida ate novo signing.');
  } else {
    warnings.push('O token reconstruido nao possui assinatura util.');
  }

  return { token, warnings };
}

export function buildRepeaterRequestWithJwt(
  transaction: JwtTransaction,
  originalToken: string,
  replacementToken: string,
): string {
  const url = transaction.request.url.split(originalToken).join(replacementToken);
  const headers = transaction.request.headers
    .map(([header, value]) => `${header}: ${value.split(originalToken).join(replacementToken)}`)
    .join('\n');
  const body =
    transaction.request.body.type === 'Text' && transaction.request.body.data
      ? transaction.request.body.data.split(originalToken).join(replacementToken)
      : transaction.request.body.type === 'Base64' && transaction.request.body.data
        ? transaction.request.body.data
        : '';

  return `URL: ${url}\nMethod: ${transaction.request.method}\n${headers}\n\n${body}`;
}

export function prettyPrintJson(value: Record<string, unknown> | null, fallbackRaw: string): string {
  if (!value) {
    return fallbackRaw;
  }
  return JSON.stringify(value, null, 2);
}

function pushCandidate(
  candidates: JwtCandidate[],
  seen: Set<string>,
  transaction: JwtTransaction,
  token: string,
  source: JwtCandidate['source'],
  container: string,
) {
  const key = `${transaction.id}:${source}:${container}:${token}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);

  const [headerRaw = '', payloadRaw = '', signature = ''] = token.split('.');
  const header = decodeSegment(headerRaw);
  const payload = decodeSegment(payloadRaw);

  candidates.push({
    id: key,
    token,
    transactionId: transaction.id,
    method: transaction.request.method,
    url: transaction.request.url,
    source,
    container,
    label: `${transaction.request.method} ${container}`,
    header,
    payload,
    signature,
    notes: analyzeJwt(header, payload, signature),
  });
}

function decodeSegment(value: string): JwtSegmentData {
  try {
    const decoded = decodeBase64Url(value);
    try {
      const json = JSON.parse(decoded) as Record<string, unknown>;
      return { raw: value, decoded, json, parseError: null };
    } catch {
      return { raw: value, decoded, json: null, parseError: 'Segmento nao e um JSON valido.' };
    }
  } catch (error) {
    return {
      raw: value,
      decoded: '',
      json: null,
      parseError: error instanceof Error ? error.message : 'Falha ao decodificar Base64URL.',
    };
  }
}

function analyzeJwt(
  header: JwtSegmentData,
  payload: JwtSegmentData,
  signature: string,
): string[] {
  const notes: string[] = ['JWT nao e criptografado por padrao; header e payload sao apenas Base64URL.'];
  const headerJson = header.json || {};
  const payloadJson = payload.json || {};

  const alg = typeof headerJson.alg === 'string' ? headerJson.alg : null;
  if (!alg) {
    notes.push('Header sem claim "alg".');
  } else if (alg.toLowerCase() === 'none') {
    notes.push('alg=none detectado; revisar validacao do backend.');
  } else {
    notes.push(`Algoritmo informado: ${alg}.`);
  }

  if (!signature) {
    notes.push('Token sem terceira parte util de assinatura.');
  }

  if (typeof headerJson.kid === 'string') {
    notes.push('Claim "kid" presente; verificar injecao ou resolucao insegura de chaves.');
  }
  if (typeof headerJson.jku === 'string' || typeof headerJson.x5u === 'string') {
    notes.push('Header referencia chave remota (jku/x5u); revisar trust e allowlist.');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (typeof payloadJson.exp === 'number') {
    notes.push(payloadJson.exp < nowSeconds ? 'Token expirado.' : 'Token ainda dentro do exp.');
  } else {
    notes.push('Payload sem exp.');
  }
  if (typeof payloadJson.nbf === 'number' && payloadJson.nbf > nowSeconds) {
    notes.push('Token ainda nao valido segundo nbf.');
  }
  if (typeof payloadJson.iat !== 'number') {
    notes.push('Payload sem iat.');
  }
  if (typeof payloadJson.aud !== 'string' && !Array.isArray(payloadJson.aud)) {
    notes.push('Payload sem aud explicita.');
  }
  if (typeof payloadJson.iss !== 'string') {
    notes.push('Payload sem iss explicita.');
  }

  return notes;
}

function findFirstJwt(value: string): string | null {
  const match = value.match(JWT_REGEX);
  return match?.[0] || null;
}

function findJwtMatches(value: string): string[] {
  return value.match(JWT_REGEX) || [];
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
