import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Database,
  Play,
  Search,
  Send,
  Shield,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useTabStore } from '../store/useTabStore';
import {
  buildJwtFromDrafts,
  buildRepeaterRequestWithJwt,
  extractJwtCandidates,
  prettyPrintJson,
  type JwtTransaction,
} from '../utils/jwt';

interface SecurityLabProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ToolOutput {
  tool: string;
  type: 'stdout' | 'stderr' | 'terminated';
  content?: string;
  code?: number;
}

interface BodyPayload {
  type: 'Text' | 'Base64' | 'Empty';
  data?: string;
}

interface HttpTransaction extends JwtTransaction {
  id: string;
  hash: string;
  request: {
    method: string;
    url: string;
    headers: [string, string][];
    body: BodyPayload;
  };
  response?: {
    status: number;
    headers: [string, string][];
    body: BodyPayload;
  };
  timestamp: number;
  size: number;
  truncated: boolean;
  tags: string[];
}

const MAX_RENDERED_TRANSACTIONS = 400;

export const SecurityLab: React.FC<SecurityLabProps> = ({ isOpen, onClose }) => {
  const [activeSegment, setActiveSegment] = useState<
    'traffic' | 'jwt' | 'recon' | 'audit' | 'repeater'
  >('traffic');
  const [transactions, setTransactions] = useState<HttpTransaction[]>([]);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [selectedJwtId, setSelectedJwtId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [nucleiLogs, setNucleiLogs] = useState<string[]>([]);
  const [jwtToolLogs, setJwtToolLogs] = useState<string[]>([]);
  const [reconResults, setReconResults] = useState<{ label: string; value: string }[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isJwtToolRunning, setIsJwtToolRunning] = useState(false);
  const [isReconRunning, setIsReconRunning] = useState(false);
  const [repeaterRaw, setRepeaterRaw] = useState('');
  const [repeaterResponse, setRepeaterResponse] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [jwtHeaderDraft, setJwtHeaderDraft] = useState('');
  const [jwtPayloadDraft, setJwtPayloadDraft] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const activeTabId = useTabStore((state) => state.activeTabId);
  const tabs = useTabStore((state) => state.tabs);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;

  const domain = useMemo(() => {
    if (!activeTab || activeTab.isInternal) return '';
    try {
      return new URL(activeTab.url).hostname;
    } catch {
      try {
        return new URL(`https://${activeTab.url}`).hostname;
      } catch {
        return '';
      }
    }
  }, [activeTab]);

  const refreshTraffic = async () => {
    try {
      const list = await invoke<HttpTransaction[]>('get_traffic_list');
      setTransactions([...list].reverse());
    } catch (error) {
      console.error('Failed to get traffic:', error);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void refreshTraffic();

    const unlistenTraffic = listen<HttpTransaction>('traffic-upserted', (event) => {
      setTransactions((current) => upsertTransaction(current, event.payload));
    });
    const unlistenTrafficCleared = listen('traffic-cleared', () => {
      setTransactions([]);
      setSelectedTxId(null);
      setSelectedJwtId(null);
    });
    const unlistenOutput = listen<ToolOutput>('security-tool-output', (event) => {
      const payload = event.payload;
      if (payload.tool === 'nuclei') {
        if (payload.type === 'stdout' || payload.type === 'stderr') {
          setNucleiLogs((prev) => [...prev.slice(-100), payload.content || '']);
        } else if (payload.type === 'terminated') {
          setIsScanning(false);
          setNucleiLogs((prev) => [
            ...prev,
            payload.code && payload.code !== 0
              ? `\n[ERRO] Nuclei finalizou com codigo ${payload.code}.`
              : '\n[FINISH] Auditoria encerrada.',
          ]);
        }
        return;
      }

      if (payload.tool === 'httpx') {
        if (payload.type === 'stdout') {
          const line = payload.content || '';
          const techMatch = line.match(/\[(.*?)\]/g);
          if (techMatch && techMatch.length > 0) {
            const techs = techMatch[techMatch.length - 1]
              .replace(/[\[\]]/g, '')
              .split(',');
            setReconResults((prev) => {
              const unique = [...prev];
              techs.forEach((tech) => {
                const value = tech.trim();
                if (!value || unique.find((item) => item.value === value)) {
                  return;
                }
                unique.push({ label: 'Tecnologia', value });
              });
              return unique;
            });
          }
        } else if (payload.type === 'terminated') {
          setIsReconRunning(false);
          if (payload.code && payload.code !== 0) {
            setReconResults((prev) => [
              ...prev,
              { label: 'Erro', value: `httpx finalizou com codigo ${payload.code}` },
            ]);
          }
        }
      }

      if (payload.tool === 'jwt_tool') {
        if (payload.type === 'stdout' || payload.type === 'stderr') {
          setJwtToolLogs((prev) => [...prev.slice(-180), payload.content || '']);
        } else if (payload.type === 'terminated') {
          setIsJwtToolRunning(false);
          setJwtToolLogs((prev) => [
            ...prev,
            payload.code && payload.code !== 0
              ? `\n[ERRO] jwt_tool finalizou com codigo ${payload.code}.`
              : '\n[FINISH] jwt_tool finalizado.',
          ]);
        }
      }
    });

    return () => {
      void unlistenTraffic.then((fn) => fn());
      void unlistenTrafficCleared.then((fn) => fn());
      void unlistenOutput.then((fn) => fn());
    };
  }, [isOpen]);

  useEffect(() => {
    if (selectedTxId && !transactions.some((transaction) => transaction.id === selectedTxId)) {
      setSelectedTxId(null);
    }
  }, [transactions, selectedTxId]);

  useEffect(() => {
    setReconResults([]);
    setIsReconRunning(false);
    setNucleiLogs([]);
  }, [domain]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeSegment, jwtToolLogs, nucleiLogs]);

  useEffect(() => {
    if (
      isOpen &&
      activeSegment === 'recon' &&
      domain &&
      reconResults.length === 0 &&
      !isReconRunning
    ) {
      void runHttpxRecon(domain, setIsReconRunning, setReconResults);
    }
  }, [activeSegment, domain, isOpen, isReconRunning, reconResults.length]);

  const filteredTxs = useMemo(
    () =>
      transactions.filter((transaction) => {
        const filter = searchQuery.toLowerCase();
        if (!filter) return true;
        return (
          transaction.request.url.toLowerCase().includes(filter) ||
          transaction.request.method.toLowerCase().includes(filter) ||
          transaction.tags.some((tag) => tag.toLowerCase().includes(filter))
        );
      }),
    [searchQuery, transactions],
  );
  const jwtCandidates = useMemo(() => extractJwtCandidates(transactions), [transactions]);
  const selectedTx = transactions.find((transaction) => transaction.id === selectedTxId) ?? null;
  const selectedJwt = jwtCandidates.find((candidate) => candidate.id === selectedJwtId) ?? null;
  const selectedJwtTransaction =
    transactions.find((transaction) => transaction.id === selectedJwt?.transactionId) ?? null;
  const jwtBuildState = useMemo(() => {
    if (!selectedJwt) {
      return {
        result: null as ReturnType<typeof buildJwtFromDrafts> | null,
        error: null as string | null,
      };
    }

    try {
      return {
        result: buildJwtFromDrafts(selectedJwt.token, jwtHeaderDraft, jwtPayloadDraft),
        error: null,
      };
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : 'Falha ao reconstruir o JWT.',
      };
    }
  }, [jwtHeaderDraft, jwtPayloadDraft, selectedJwt]);

  useEffect(() => {
    if (selectedJwtId && !jwtCandidates.some((candidate) => candidate.id === selectedJwtId)) {
      setSelectedJwtId(null);
    }
  }, [jwtCandidates, selectedJwtId]);

  useEffect(() => {
    if (activeSegment === 'jwt' && !selectedJwtId && jwtCandidates.length > 0) {
      setSelectedJwtId(jwtCandidates[0].id);
    }
  }, [activeSegment, jwtCandidates, selectedJwtId]);

  useEffect(() => {
    if (!selectedJwt) {
      setJwtHeaderDraft('');
      setJwtPayloadDraft('');
      return;
    }

    setJwtHeaderDraft(prettyPrintJson(selectedJwt.header.json, selectedJwt.header.decoded));
    setJwtPayloadDraft(prettyPrintJson(selectedJwt.payload.json, selectedJwt.payload.decoded));
  }, [selectedJwt]);

  const clearTraffic = async () => {
    try {
      await invoke('clear_traffic');
      setTransactions([]);
      setSelectedTxId(null);
      setSelectedJwtId(null);
    } catch (error) {
      console.error('Failed to clear traffic:', error);
    }
  };

  const runNuclei = async () => {
    if (!domain) return;
    const target = domain.startsWith('http://') || domain.startsWith('https://')
      ? domain
      : `https://${domain}`;
    setIsScanning(true);
    setNucleiLogs([`[INFO] Iniciando Nuclei Audit em: ${target}...`]);
    try {
      await invoke('run_security_tool', {
        toolName: 'nuclei',
        args: ['-u', target, '-silent', '-nc'],
      });
    } catch (error) {
      setNucleiLogs((prev) => [...prev, `[ERRO] ${error}`]);
      setIsScanning(false);
    }
  };

  const runJwtToolAudit = async () => {
    if (!selectedJwt || isJwtToolRunning) return;
    setIsJwtToolRunning(true);
    setJwtToolLogs([
      '[INFO] Iniciando jwt_tool no modo Playbook (-M pb)...',
      `[INFO] Origem do token: ${selectedJwt.method} ${selectedJwt.url}`,
    ]);

    try {
      await invoke('run_security_tool', {
        toolName: 'jwt_tool',
        args: [selectedJwt.token, '-M', 'pb'],
      });
    } catch (error) {
      setJwtToolLogs((prev) => [...prev, `[ERRO] ${error}`]);
      setIsJwtToolRunning(false);
    }
  };

  const sendToRepeater = (transaction: HttpTransaction) => {
    const requestHeaders = transaction.request.headers
      .map(([header, value]) => `${header}: ${value}`)
      .join('\n');
    const requestBody =
      transaction.request.body.type === 'Text' || transaction.request.body.type === 'Base64'
        ? transaction.request.body.data || ''
        : '';

    setRepeaterRaw(
      `URL: ${transaction.request.url}\nMethod: ${transaction.request.method}\n${requestHeaders}\n\n${requestBody}`,
    );
    setRepeaterResponse(null);
    setActiveSegment('repeater');
  };

  const resetJwtDrafts = () => {
    if (!selectedJwt) {
      return;
    }

    setJwtHeaderDraft(prettyPrintJson(selectedJwt.header.json, selectedJwt.header.decoded));
    setJwtPayloadDraft(prettyPrintJson(selectedJwt.payload.json, selectedJwt.payload.decoded));
  };

  const sendJwtToRepeater = () => {
    if (!selectedJwt || !selectedJwtTransaction || !jwtBuildState.result) {
      return;
    }

    setRepeaterRaw(
      buildRepeaterRequestWithJwt(
        selectedJwtTransaction,
        selectedJwt.token,
        jwtBuildState.result.token,
      ),
    );
    setRepeaterResponse(null);
    setActiveSegment('repeater');
  };

  const sendRepeater = async () => {
    if (!repeaterRaw.trim()) return;
    setIsSending(true);
    setRepeaterResponse('Enviando...');

    try {
      const lines = repeaterRaw.split('\n');
      let method = 'GET';
      let url = domain ? `https://${domain}` : '';
      const headers: Record<string, string> = {};
      const bodyLines: string[] = [];
      let isBody = false;

      for (const line of lines) {
        if (isBody) {
          bodyLines.push(line);
          continue;
        }
        if (line.trim() === '') {
          isBody = true;
          continue;
        }
        if (line.startsWith('URL:')) {
          url = line.replace('URL:', '').trim();
          continue;
        }
        if (line.startsWith('Method:')) {
          method = line.replace('Method:', '').trim();
          continue;
        }

        const headerMatch = line.match(/^([\w-]+):\s*(.*)$/);
        if (headerMatch) {
          headers[headerMatch[1].toLowerCase()] = headerMatch[2];
        }
      }

      const response = await invoke<{
        status: number;
        headers: Record<string, string>;
        body: string;
      }>('send_repeater_request', {
        req: {
          method,
          url,
          headers,
          body: bodyLines.join('\n').trim() || null,
        },
      });

      setRepeaterResponse(
        `HTTP/1.1 ${response.status}\n${Object.entries(response.headers)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n')}\n\n${response.body}`,
      );
    } catch (error) {
      setRepeaterResponse(`[ERRO] ${error}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <aside
      className="security-lab-sidebar"
      style={{
        width: isOpen ? '420px' : '0px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderLeft: isOpen ? '1px solid var(--kc-border-main)' : '0px solid transparent',
        background: 'rgba(18, 18, 18, 0.92)',
        backdropFilter: 'blur(20px) saturate(140%)',
        zIndex: 5,
        boxShadow: isOpen ? '-8px 0 32px rgba(0,0,0,0.45)' : 'none',
        transition: 'width 0.28s ease, opacity 0.2s ease',
        overflow: 'hidden',
        flexShrink: 0,
        opacity: isOpen ? 1 : 0,
      }}
    >
      <header
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--kc-border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minWidth: '420px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--kc-text-primary)',
            fontSize: 'var(--kc-font-size-title)',
            fontWeight: 600,
          }}
        >
          <Terminal size={14} strokeWidth={2.4} />
          <span>Security Lab</span>
        </div>
        <button
          onClick={onClose}
          style={iconButtonStyle}
          aria-label="Fechar Security Lab"
          type="button"
        >
          <X size={14} />
        </button>
      </header>

      <nav
        style={{
          display: 'flex',
          padding: '12px 16px 8px',
          gap: '4px',
          minWidth: '420px',
        }}
      >
        {(['traffic', 'jwt', 'recon', 'audit', 'repeater'] as const).map((segment) => (
          <button
            key={segment}
            onClick={() => {
              setActiveSegment(segment);
              if (segment !== 'traffic') setSelectedTxId(null);
            }}
            style={segmentButtonStyle(activeSegment === segment)}
            type="button"
          >
            {segment === 'traffic' && <Activity size={10} />}
            {segment === 'jwt' && <span style={{ fontSize: '9px', fontWeight: 800 }}>JWT</span>}
            {segment === 'recon' && <Database size={10} />}
            {segment === 'audit' && <Shield size={10} />}
            {segment === 'repeater' && <Send size={10} />}
            <span>{segment === 'audit' ? 'Audit' : capitalize(segment)}</span>
          </button>
        ))}
      </nav>

      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          minWidth: '420px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {activeSegment === 'traffic' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
            <div
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--kc-border-subtle)',
                borderRadius: '10px',
                padding: '10px 12px',
                fontSize: '11px',
                color: 'var(--kc-text-secondary)',
                lineHeight: 1.5,
              }}
            >
              Painel incremental para pentest: captura nativa de recursos e detalhes de
              `fetch/XHR` quando o browser consegue inspecionar corpo e headers.
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search
                  size={12}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--kc-text-muted)',
                  }}
                />
                <input
                  type="text"
                  placeholder="Filtrar URL, método ou tag..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--kc-border-subtle)',
                    borderRadius: '8px',
                    padding: '8px 8px 8px 32px',
                    fontSize: '11px',
                    color: 'var(--kc-text-primary)',
                    outline: 'none',
                  }}
                />
              </div>
              <button
                onClick={clearTraffic}
                style={iconButtonStyle}
                title="Limpar tráfego"
                type="button"
              >
                <Trash2 size={12} />
              </button>
            </div>

            <div
              style={{
                flex: selectedTx ? '0 0 220px' : 1,
                background: '#0a0a0a',
                borderRadius: '10px',
                border: '1px solid var(--kc-border-main)',
                overflowY: 'auto',
              }}
            >
              {filteredTxs.map((transaction) => (
                <button
                  key={transaction.id}
                  onClick={() =>
                    setSelectedTxId((current) =>
                      current === transaction.id ? null : transaction.id,
                    )
                  }
                  type="button"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    cursor: 'pointer',
                    background:
                      selectedTxId === transaction.id ? 'rgba(255,255,255,0.04)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ minWidth: '42px', fontSize: '9px', fontWeight: 800 }}>
                    {transaction.request.method}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--kc-text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {transaction.request.url}
                    </div>
                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                      {transaction.tags.map((tag) => (
                        <span key={tag} style={tagStyle}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div
                    style={{
                      minWidth: '44px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: getStatusColor(transaction.response?.status),
                    }}
                  >
                    {transaction.response?.status ?? '...'}
                  </div>
                </button>
              ))}
              {filteredTxs.length === 0 ? (
                <div
                  style={{
                    padding: '40px 20px',
                    textAlign: 'center',
                    color: 'var(--kc-text-muted)',
                    fontSize: '11px',
                  }}
                >
                  {searchQuery ? 'Sem resultados para o filtro.' : 'Aguardando tráfego...'}
                </div>
              ) : null}
            </div>

            {selectedTx ? (
              <div
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--kc-border-subtle)',
                  borderRadius: '10px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  minHeight: '260px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '10px', letterSpacing: '0.06em', color: 'var(--kc-text-muted)' }}>
                      REQUISIÇÃO SELECIONADA
                    </div>
                    <strong style={{ color: 'var(--kc-text-primary)', fontSize: '12px' }}>
                      {selectedTx.request.method} {selectedTx.request.url}
                    </strong>
                  </div>
                  <button onClick={() => sendToRepeater(selectedTx)} style={iconButtonStyle} type="button">
                    <Send size={12} />
                  </button>
                </div>

                <div style={{ fontSize: '10px', color: 'var(--kc-text-secondary)' }}>
                  {formatTimestamp(selectedTx.timestamp)} | {selectedTx.size} bytes
                  {selectedTx.truncated ? ' | preview truncado' : ''}
                </div>

                <DetailBlock title="Request Headers" lines={selectedTx.request.headers} />
                <BodyBlock title="Request Body" body={selectedTx.request.body} />
                <DetailBlock
                  title={`Response Headers${selectedTx.response ? ` (${selectedTx.response.status})` : ''}`}
                  lines={selectedTx.response?.headers || []}
                  emptyLabel="Sem headers de resposta capturados."
                />
                <BodyBlock
                  title="Response Body"
                  body={selectedTx.response?.body || { type: 'Empty' }}
                  emptyLabel="Sem corpo de resposta capturado."
                />
              </div>
            ) : null}

            <div style={{ fontSize: '10px', color: 'var(--kc-text-muted)', textAlign: 'right' }}>
              {transactions.length} / {MAX_RENDERED_TRANSACTIONS} eventos mantidos em memória
            </div>
          </div>
        ) : null}

        {activeSegment === 'jwt' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={panelStyle}>
              <div style={sectionLabelStyle}>JWT Lab</div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--kc-text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                Header e payload de JWT normalmente nao sao criptografados: sao apenas JSON em
                Base64URL. Aqui voce pode inspecionar, editar o JSON e mandar a requisicao
                reconstruida para o Repeater.
              </div>
              <div
                style={{
                  marginTop: '10px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: '8px',
                }}
              >
                <MetricCard label="JWTs detectados" value={String(jwtCandidates.length)} />
                <MetricCard
                  label="Fontes unicas"
                  value={String(new Set(jwtCandidates.map((candidate) => candidate.source)).size)}
                />
                <MetricCard
                  label="Requests com JWT"
                  value={String(
                    new Set(jwtCandidates.map((candidate) => candidate.transactionId)).size,
                  )}
                />
              </div>
              <div
                style={{
                  marginTop: '12px',
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                <button
                  onClick={runJwtToolAudit}
                  disabled={!selectedJwt || isJwtToolRunning}
                  style={{
                    ...iconButtonStyle,
                    width: 'auto',
                    padding: '8px 12px',
                    gap: '6px',
                    color: 'var(--kc-text-primary)',
                    opacity: !selectedJwt && !isJwtToolRunning ? 0.7 : 1,
                  }}
                  type="button"
                >
                  <Play size={10} fill="currentColor" />
                  {isJwtToolRunning ? 'Executando jwt_tool' : 'Run jwt_tool (Audit)'}
                </button>
              </div>
            </div>

            <div
              style={{
                background: '#0a0a0a',
                borderRadius: '10px',
                border: '1px solid var(--kc-border-main)',
                overflowY: 'auto',
                maxHeight: '220px',
              }}
            >
              {jwtCandidates.map((candidate) => (
                <button
                  key={candidate.id}
                  onClick={() => setSelectedJwtId(candidate.id)}
                  type="button"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    cursor: 'pointer',
                    background:
                      selectedJwtId === candidate.id ? 'rgba(255,255,255,0.04)' : 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '8px',
                      alignItems: 'center',
                    }}
                  >
                    <strong style={{ color: 'var(--kc-text-primary)', fontSize: '11px' }}>
                      {candidate.method} {candidate.container}
                    </strong>
                    <span style={tagStyle}>{candidate.source}</span>
                  </div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: 'var(--kc-text-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {candidate.url}
                  </div>
                </button>
              ))}
              {jwtCandidates.length === 0 ? (
                <div
                  style={{
                    padding: '32px 20px',
                    textAlign: 'center',
                    color: 'var(--kc-text-muted)',
                    fontSize: '11px',
                  }}
                >
                  Nenhum JWT detectado no trafego atual.
                </div>
              ) : null}
            </div>

            {selectedJwt ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={panelStyle}>
                  <div style={sectionLabelStyle}>Token Selecionado</div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--kc-text-primary)',
                      fontWeight: 600,
                      marginBottom: '8px',
                    }}
                  >
                    {selectedJwt.method} {selectedJwt.url}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '6px',
                      flexWrap: 'wrap',
                      marginBottom: '8px',
                    }}
                  >
                    <span style={tagStyle}>{selectedJwt.source}</span>
                    <span style={tagStyle}>{selectedJwt.container}</span>
                    <span style={tagStyle}>
                      assinatura {selectedJwt.signature ? 'presente' : 'ausente'}
                    </span>
                  </div>
                  <div
                    style={{
                      background: '#0a0a0a',
                      borderRadius: '8px',
                      border: '1px solid var(--kc-border-main)',
                      padding: '10px',
                      fontFamily: 'var(--kc-font-mono)',
                      fontSize: '10px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      color: '#cad3f5',
                    }}
                  >
                    {selectedJwt.token}
                  </div>
                </div>

                <div style={panelStyle}>
                  <div style={sectionLabelStyle}>JWT Notes</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {selectedJwt.notes.map((note, index) => (
                      <div
                        key={`${note}-${index}`}
                        style={{
                          fontSize: '11px',
                          color: 'var(--kc-text-secondary)',
                          lineHeight: 1.45,
                        }}
                      >
                        {note}
                      </div>
                    ))}
                    {selectedJwt.header.parseError ? (
                      <div style={{ fontSize: '11px', color: '#ffb347' }}>
                        Header: {selectedJwt.header.parseError}
                      </div>
                    ) : null}
                    {selectedJwt.payload.parseError ? (
                      <div style={{ fontSize: '11px', color: '#ffb347' }}>
                        Payload: {selectedJwt.payload.parseError}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div>
                  <div style={sectionLabelStyle}>Header JSON</div>
                  <textarea
                    value={jwtHeaderDraft}
                    onChange={(event) => setJwtHeaderDraft(event.target.value)}
                    style={editorStyle}
                  />
                </div>

                <div>
                  <div style={sectionLabelStyle}>Payload JSON</div>
                  <textarea
                    value={jwtPayloadDraft}
                    onChange={(event) => setJwtPayloadDraft(event.target.value)}
                    style={editorStyle}
                  />
                </div>

                <div style={panelStyle}>
                  <div style={sectionLabelStyle}>JWT Reconstruido</div>
                  {jwtBuildState.error ? (
                    <div style={{ fontSize: '11px', color: 'var(--kc-danger)', lineHeight: 1.5 }}>
                      {jwtBuildState.error}
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          background: '#0a0a0a',
                          borderRadius: '8px',
                          border: '1px solid var(--kc-border-main)',
                          padding: '10px',
                          fontFamily: 'var(--kc-font-mono)',
                          fontSize: '10px',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          color: '#cad3f5',
                        }}
                      >
                        {jwtBuildState.result?.token || 'Sem token reconstruido.'}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          marginTop: '10px',
                        }}
                      >
                        {jwtBuildState.result?.warnings.map((warning, index) => (
                          <div
                            key={`${warning}-${index}`}
                            style={{ fontSize: '11px', color: '#ffb347' }}
                          >
                            {warning}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button onClick={resetJwtDrafts} style={secondaryActionStyle} type="button">
                      Restaurar JSON
                    </button>
                    <button
                      onClick={sendJwtToRepeater}
                      disabled={!selectedJwtTransaction || !jwtBuildState.result}
                      style={primaryActionStyle(!selectedJwtTransaction || !jwtBuildState.result)}
                      type="button"
                    >
                      Enviar ao Repeater
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div style={panelStyle}>
              <div style={sectionLabelStyle}>jwt_tool Output</div>
              <div
                ref={scrollRef}
                style={{
                  background: '#0a0a0a',
                  borderRadius: '8px',
                  padding: '12px',
                  height: '220px',
                  overflowY: 'auto',
                  fontFamily: 'var(--kc-font-mono)',
                  fontSize: '11px',
                  border: '1px solid var(--kc-border-main)',
                  lineHeight: 1.5,
                }}
              >
                {jwtToolLogs.length === 0 ? (
                  <div style={{ color: 'var(--kc-text-disabled)' }}>
                    Clique em "Run jwt_tool (Audit)" para iniciar a auditoria do token selecionado.
                  </div>
                ) : (
                  jwtToolLogs.map((log, index) => (
                    <div
                      key={`${log}-${index}`}
                      style={{
                        color: log.includes('[ERRO]')
                          ? 'var(--kc-danger)'
                          : log.includes('[INFO]')
                            ? 'var(--kc-text-secondary)'
                            : '#a5d6ff',
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        paddingBottom: '2px',
                        marginBottom: '4px',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}

        {activeSegment === 'recon' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={panelStyle}>
              <div style={sectionLabelStyle}>Stack de Tecnologia</div>
              {isReconRunning && reconResults.length === 0 ? (
                <div style={{ color: 'var(--kc-text-secondary)' }}>Analisando {domain}...</div>
              ) : reconResults.length > 0 ? (
                reconResults.map((result, index) => (
                  <div
                    key={`${result.value}-${index}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '12px',
                      fontSize: '12px',
                      marginBottom: '8px',
                    }}
                  >
                    <span style={{ color: 'var(--kc-text-secondary)' }}>{result.label}</span>
                    <strong style={{ color: 'var(--kc-text-primary)' }}>{result.value}</strong>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--kc-text-secondary)' }}>
                  Navegue para um alvo e abra esta aba para iniciar o reconhecimento.
                </div>
              )}
            </div>
          </div>
        ) : null}

        {activeSegment === 'audit' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <span style={{ fontSize: '11px', color: 'var(--kc-text-secondary)' }}>
                Alvo: <strong style={{ color: 'var(--kc-text-primary)' }}>{domain || 'Nenhum'}</strong>
              </span>
              <button
                onClick={runNuclei}
                disabled={!domain || isScanning}
                style={{
                  ...iconButtonStyle,
                  width: 'auto',
                  padding: '8px 12px',
                  gap: '6px',
                  color: 'var(--kc-text-primary)',
                }}
                type="button"
              >
                <Play size={10} fill="currentColor" />
                {isScanning ? 'Executando' : 'Iniciar Scan'}
              </button>
            </div>

            <div
              ref={scrollRef}
              style={{
                background: '#0a0a0a',
                borderRadius: '10px',
                padding: '12px',
                height: '420px',
                overflowY: 'auto',
                fontFamily: 'var(--kc-font-mono)',
                fontSize: '11px',
                border: '1px solid var(--kc-border-main)',
                lineHeight: 1.5,
              }}
            >
              {nucleiLogs.length === 0 ? (
                <div style={{ color: 'var(--kc-text-disabled)', textAlign: 'center', paddingTop: '40px' }}>
                  Nenhum log de auditoria ainda.
                </div>
              ) : (
                nucleiLogs.map((log, index) => (
                  <div
                    key={`${log}-${index}`}
                    style={{
                      color: log.includes('[ERRO]')
                        ? 'var(--kc-danger)'
                        : log.includes('[INFO]')
                          ? 'var(--kc-text-secondary)'
                          : '#a5d6ff',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      paddingBottom: '2px',
                      marginBottom: '4px',
                    }}
                  >
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        {activeSegment === 'repeater' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={sectionLabelStyle}>Request Editor</div>
              <textarea
                value={repeaterRaw}
                onChange={(event) => setRepeaterRaw(event.target.value)}
                placeholder={`URL: https://${domain || 'exemplo.com'}\nMethod: GET\n\n[Corpo opcional]`}
                style={{
                  width: '100%',
                  height: '180px',
                  background: '#0a0a0a',
                  color: '#fff',
                  border: '1px solid var(--kc-border-main)',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '12px',
                  fontFamily: 'var(--kc-font-mono)',
                  resize: 'none',
                  outline: 'none',
                }}
              />
              <button
                onClick={sendRepeater}
                disabled={isSending}
                style={{
                  ...iconButtonStyle,
                  width: '100%',
                  justifyContent: 'center',
                  marginTop: '10px',
                  padding: '10px 12px',
                  color: 'var(--kc-text-primary)',
                }}
                type="button"
              >
                {isSending ? 'Enviando...' : 'Repetir Requisição'}
              </button>
            </div>

            <div>
              <div style={sectionLabelStyle}>Response</div>
              <div
                style={{
                  background: '#0a0a0a',
                  borderRadius: '8px',
                  padding: '12px',
                  height: '260px',
                  overflowY: 'auto',
                  fontFamily: 'var(--kc-font-mono)',
                  fontSize: '11px',
                  color: '#cad3f5',
                  border: '1px solid var(--kc-border-main)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {repeaterResponse || 'Aguardando envio...'}
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </aside>
  );
};

const iconButtonStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid var(--kc-border-subtle)',
  borderRadius: '8px',
  color: 'var(--kc-text-secondary)',
  cursor: 'pointer',
  padding: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const panelStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  borderRadius: '10px',
  padding: '16px',
  border: '1px solid var(--kc-border-subtle)',
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--kc-text-muted)',
  display: 'block',
  marginBottom: '8px',
  fontWeight: 700,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
};

const editorStyle: React.CSSProperties = {
  width: '100%',
  height: '160px',
  background: '#0a0a0a',
  color: '#fff',
  border: '1px solid var(--kc-border-main)',
  borderRadius: '8px',
  padding: '12px',
  fontSize: '12px',
  fontFamily: 'var(--kc-font-mono)',
  resize: 'vertical',
  outline: 'none',
};

const secondaryActionStyle: React.CSSProperties = {
  flex: 1,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid var(--kc-border-subtle)',
  borderRadius: '8px',
  color: 'var(--kc-text-secondary)',
  cursor: 'pointer',
  padding: '10px 12px',
  fontSize: '11px',
  fontWeight: 600,
};

const tagStyle: React.CSSProperties = {
  fontSize: '9px',
  padding: '2px 5px',
  borderRadius: '4px',
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--kc-text-secondary)',
  border: '1px solid rgba(255,255,255,0.08)',
};

function primaryActionStyle(disabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    background: disabled ? 'rgba(255,255,255,0.05)' : 'rgba(120, 190, 255, 0.18)',
    border: '1px solid rgba(120, 190, 255, 0.28)',
    borderRadius: '8px',
    color: disabled ? 'var(--kc-text-muted)' : 'var(--kc-text-primary)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    padding: '10px 12px',
    fontSize: '11px',
    fontWeight: 600,
  };
}

function segmentButtonStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '7px 4px',
    fontSize: '11px',
    fontWeight: 500,
    borderRadius: '6px',
    border: 'none',
    background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
    color: active ? 'var(--kc-text-primary)' : 'var(--kc-text-secondary)',
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
  };
}

function upsertTransaction(list: HttpTransaction[], transaction: HttpTransaction): HttpTransaction[] {
  const index = list.findIndex((item) => item.id === transaction.id);
  if (index === -1) {
    return [transaction, ...list].slice(0, MAX_RENDERED_TRANSACTIONS);
  }

  const next = [...list];
  next[index] = transaction;
  return next;
}

function getStatusColor(status?: number): string {
  if (!status) return 'var(--kc-text-muted)';
  if (status >= 400) return '#ff6b6b';
  if (status >= 300) return '#ffb347';
  return '#77dd77';
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const MetricCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div
    style={{
      background: '#0a0a0a',
      borderRadius: '8px',
      border: '1px solid var(--kc-border-main)',
      padding: '10px',
    }}
  >
    <div style={{ fontSize: '9px', color: 'var(--kc-text-muted)', marginBottom: '4px' }}>{label}</div>
    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--kc-text-primary)' }}>{value}</div>
  </div>
);

const DetailBlock: React.FC<{
  title: string;
  lines: [string, string][];
  emptyLabel?: string;
}> = ({ title, lines, emptyLabel = 'Sem dados capturados.' }) => (
  <div>
    <div style={sectionLabelStyle}>{title}</div>
    <div
      style={{
        background: '#0a0a0a',
        borderRadius: '8px',
        border: '1px solid var(--kc-border-main)',
        padding: '10px',
        fontFamily: 'var(--kc-font-mono)',
        fontSize: '10px',
        maxHeight: '140px',
        overflowY: 'auto',
      }}
    >
      {lines.length === 0 ? (
        <div style={{ color: 'var(--kc-text-muted)' }}>{emptyLabel}</div>
      ) : (
        lines.map(([key, value], index) => (
          <div key={`${key}-${index}`} style={{ marginBottom: '4px' }}>
            <span style={{ color: '#8bd5ca' }}>{key}:</span>{' '}
            <span style={{ color: '#cad3f5' }}>{value}</span>
          </div>
        ))
      )}
    </div>
  </div>
);

const BodyBlock: React.FC<{
  title: string;
  body: BodyPayload;
  emptyLabel?: string;
}> = ({ title, body, emptyLabel = 'Sem corpo capturado.' }) => (
  <div>
    <div style={sectionLabelStyle}>{title}</div>
    <div
      style={{
        background: '#0a0a0a',
        borderRadius: '8px',
        border: '1px solid var(--kc-border-main)',
        padding: '10px',
        fontFamily: 'var(--kc-font-mono)',
        fontSize: '10px',
        whiteSpace: 'pre-wrap',
        maxHeight: '180px',
        overflowY: 'auto',
        color: '#cad3f5',
      }}
    >
      {body.type === 'Empty' ? emptyLabel : body.data || emptyLabel}
    </div>
  </div>
);

async function runHttpxRecon(
  domain: string,
  setIsReconRunning: React.Dispatch<React.SetStateAction<boolean>>,
  setReconResults: React.Dispatch<React.SetStateAction<{ label: string; value: string }[]>>,
) {
  if (!domain) return;
  const target =
    domain.startsWith('http://') || domain.startsWith('https://') ? domain : `https://${domain}`;
  setIsReconRunning(true);
  setReconResults([]);
  try {
    await invoke('run_security_tool', {
      toolName: 'httpx',
      args: ['-u', target, '-td', '-silent', '-nc'],
    });
  } catch (error) {
    console.error('Recon failed:', error);
    setReconResults([{ label: 'Erro', value: String(error) }]);
    setIsReconRunning(false);
  }
}
