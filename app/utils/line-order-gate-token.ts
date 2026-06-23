type QueryValue = string | null | Array<string | null> | undefined;

type RouteQuery = Record<string, QueryValue>;

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

const readTokenFromUrlCandidate = (candidate: string): string => {
  const trimmed = candidate.trim();
  if (!trimmed) return '';

  const decoded = decodeCandidate(trimmed);
  const directSearchToken = readTokenFromSearch(decoded);
  if (directSearchToken) return directSearchToken;

  try {
    const url = new URL(decoded, 'https://status.surfboards-reborn.com');
    const searchToken = url.searchParams.get('t');
    if (searchToken) return searchToken;

    for (const key of ['liff.state', 'liff_state']) {
      const stateToken = readTokenFromUrlCandidate(url.searchParams.get(key) ?? '');
      if (stateToken) return stateToken;
    }

    if (url.hash) {
      return readTokenFromUrlCandidate(url.hash.slice(1));
    }
  } catch {
    return '';
  }

  return '';
};

export const extractLineOrderGateToken = (
  query: RouteQuery,
  currentUrl = typeof window === 'undefined' ? '' : window.location.href,
) => {
  const directToken = firstString(query.t).trim();
  if (directToken) return directToken;

  for (const key of ['liff.state', 'liff_state']) {
    const stateToken = readTokenFromUrlCandidate(firstString(query[key]));
    if (stateToken) return stateToken;
  }

  return readTokenFromUrlCandidate(currentUrl);
};
