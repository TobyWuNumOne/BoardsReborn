type QueryValue = string | null | Array<string | null> | undefined;

type RouteQuery = Record<string, QueryValue>;

export type LineOrderGateTokenSource =
  | 'query.t'
  | 'liff.state'
  | 'liff_state'
  | 'currentUrl'
  | 'hash'
  | 'missing';

export interface LineOrderGateTokenInfo {
  source: LineOrderGateTokenSource;
  token: string;
}

const firstString = (value: QueryValue) => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return (
      value.find((item): item is string => typeof item === 'string' && item.trim() !== '') ?? ''
    );
  }
  return '';
};

const decodeCandidate = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const readTokenFromSearch = (value: string) => {
  const params = new URLSearchParams(value.startsWith('?') ? value.slice(1) : value);
  return params.get('t') ?? '';
};

const readTokenFromUrlCandidate = (
  candidate: string,
  source: LineOrderGateTokenSource,
): LineOrderGateTokenInfo | null => {
  const trimmed = candidate.trim();
  if (!trimmed) return null;

  const candidates = Array.from(new Set([trimmed, decodeCandidate(trimmed)]));

  for (const value of candidates) {
    const directSearchToken = readTokenFromSearch(value);
    if (directSearchToken) return { source, token: directSearchToken };

    try {
      const url = new URL(value, 'https://status.surfboards-reborn.com');
      const searchToken = url.searchParams.get('t');
      if (searchToken) return { source, token: searchToken };

      for (const key of ['liff.state', 'liff_state']) {
        const stateToken = readTokenFromUrlCandidate(
          url.searchParams.get(key) ?? '',
          key as LineOrderGateTokenSource,
        );
        if (stateToken) return stateToken;
      }

      if (url.hash) {
        return readTokenFromUrlCandidate(url.hash.slice(1), 'hash');
      }
    } catch {
      // Continue with the decoded fallback candidate.
    }
  }

  return null;
};

export const getLineOrderGateTokenInfo = (
  query: RouteQuery,
  currentUrl = typeof window === 'undefined' ? '' : window.location.href,
): LineOrderGateTokenInfo => {
  const directToken = firstString(query.t).trim();
  if (directToken) return { source: 'query.t', token: directToken };

  for (const key of ['liff.state', 'liff_state']) {
    const stateToken = readTokenFromUrlCandidate(
      firstString(query[key]),
      key as LineOrderGateTokenSource,
    );
    if (stateToken) return stateToken;
  }

  return readTokenFromUrlCandidate(currentUrl, 'currentUrl') ?? { source: 'missing', token: '' };
};

export const extractLineOrderGateToken = (query: RouteQuery, currentUrl?: string) =>
  getLineOrderGateTokenInfo(query, currentUrl).token;
