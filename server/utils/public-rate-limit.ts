import { getHeader, type H3Event } from 'h3';
import { TooManyRequestsError } from './api-errors';

export interface InMemoryRateLimitEntry {
  count: number;
  resetAtMs: number;
}

export interface InMemoryRateLimitOptions {
  key: string;
  limit: number;
  nowMs?: number;
  store?: Map<string, InMemoryRateLimitEntry>;
  windowMs: number;
}

const PUBLIC_LOOKUP_RATE_LIMIT = 10;
const PUBLIC_LOOKUP_RATE_WINDOW_MS = 60 * 1000;
const publicLookupRateLimitStore = new Map<string, InMemoryRateLimitEntry>();

const getFirstForwardedIp = (value: string | undefined) => {
  const firstIp = value?.split(',')[0]?.trim();
  return firstIp || null;
};

export const getRateLimitClientIp = (event: H3Event) => {
  const forwardedFor = getHeader(event, 'x-forwarded-for');
  const forwardedIp = Array.isArray(forwardedFor)
    ? getFirstForwardedIp(forwardedFor[0])
    : getFirstForwardedIp(forwardedFor);

  if (forwardedIp) {
    return forwardedIp;
  }

  return event.node.req.socket?.remoteAddress?.trim() || 'unknown';
};

export const applyInMemoryRateLimit = ({
  key,
  limit,
  nowMs = Date.now(),
  store = publicLookupRateLimitStore,
  windowMs,
}: InMemoryRateLimitOptions) => {
  const existingEntry = store.get(key);

  if (!existingEntry || existingEntry.resetAtMs <= nowMs) {
    store.set(key, {
      count: 1,
      resetAtMs: nowMs + windowMs,
    });
    return;
  }

  if (existingEntry.count >= limit) {
    throw new TooManyRequestsError('查詢次數過多，請稍後再試。');
  }

  store.set(key, {
    ...existingEntry,
    count: existingEntry.count + 1,
  });
};

export const enforcePublicLookupRateLimit = (
  event: H3Event,
  options: {
    nowMs?: number;
    store?: Map<string, InMemoryRateLimitEntry>;
  } = {},
) => {
  const ip = getRateLimitClientIp(event);

  applyInMemoryRateLimit({
    key: `public-lookup:${ip}`,
    limit: PUBLIC_LOOKUP_RATE_LIMIT,
    nowMs: options.nowMs,
    store: options.store,
    windowMs: PUBLIC_LOOKUP_RATE_WINDOW_MS,
  });
};

export const enforcePublicLineBindRateLimit = (event: H3Event) => {
  const ip = getRateLimitClientIp(event);
  applyInMemoryRateLimit({
    key: `public-line-bind:${ip}`,
    limit: PUBLIC_LOOKUP_RATE_LIMIT,
    windowMs: PUBLIC_LOOKUP_RATE_WINDOW_MS,
  });
};
