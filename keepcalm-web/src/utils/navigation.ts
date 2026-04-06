export const START_PAGE_URL = 'keepcalm://start';

const SEARCH_URL = 'https://duckduckgo.com/';

export function isInternalPage(url: string): boolean {
  return !url || url === START_PAGE_URL;
}

export function getInternalPageTitle(): string {
  return 'New Tab';
}

export function normalizeUserInput(input: string): { url: string; isInternal: boolean } {
  const value = input.trim();

  if (!value || isInternalPage(value)) {
    return { url: START_PAGE_URL, isInternal: true };
  }

  if (hasProtocol(value)) {
    return { url: safelyParseUrl(value), isInternal: false };
  }

  if (looksLikeSearch(value)) {
    return { url: buildSearchUrl(value), isInternal: false };
  }

  return { url: safelyParseUrl(`https://${value}`), isInternal: false };
}

export function getAddressFieldValue(url: string, isInternal: boolean): string {
  if (isInternal) {
    return '';
  }

  return url;
}

function hasProtocol(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value);
}

function looksLikeSearch(value: string): boolean {
  return value.includes(' ') || !/[.:]/.test(value);
}

function buildSearchUrl(query: string): string {
  const url = new URL(SEARCH_URL);
  url.searchParams.set('q', query);
  return url.toString();
}

function safelyParseUrl(value: string): string {
  try {
    return new URL(value).toString();
  } catch {
    return buildSearchUrl(value);
  }
}
