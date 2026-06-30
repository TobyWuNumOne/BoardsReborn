import { createHash } from 'node:crypto';
import { getHeader, type H3Event } from 'h3';
import { TooManyRequestsError } from './api-errors';
import type { ServiceRoleSupabaseClient } from './supabase-clients';
import { throwMappedSupabaseError } from './supabase-errors';

export interface PublicRateLimitOptions {
  key: string;
  limit: number;
  windowSeconds: number;
}

const PUBLIC_LOOKUP_RATE_LIMIT = 10;
const PUBLIC_LOOKUP_IP_RATE_LIMIT = 60;
const PUBLIC_LOOKUP_RATE_WINDOW_SECONDS = 60;

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

const hashRateLimitPart = (value: string) => createHash('sha256').update(value).digest('hex');

const parseRateLimitResult = (value: unknown) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const result = value as Record<string, unknown>;
  if (typeof result.allowed !== 'boolean') {
    return null;
  }

  return result as {
    allowed: boolean;
    remaining?: number;
    resetAt?: string;
  };
};

export const buildPublicLookupRateLimitKey = (input: {
  ip: string;
  normalizedPhone: string;
  paperOrderNo: string;
}) =>
  [
    'public-lookup',
    hashRateLimitPart(input.ip),
    hashRateLimitPart(input.paperOrderNo.trim().toUpperCase()),
    hashRateLimitPart(input.normalizedPhone),
  ].join(':');

export const buildPublicLookupIpRateLimitKey = (input: { ip: string }) =>
  ['public-lookup-ip', hashRateLimitPart(input.ip)].join(':');

export const buildPublicLineBindRateLimitKey = (input: { ip: string }) =>
  ['public-line-bind', hashRateLimitPart(input.ip)].join(':');

export const enforcePublicRateLimit = async (
  supabase: ServiceRoleSupabaseClient,
  { key, limit, windowSeconds }: PublicRateLimitOptions,
) => {
  const { data, error } = await supabase.rpc('check_public_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    throwMappedSupabaseError(error);
  }

  const result = parseRateLimitResult(data);
  if (!result?.allowed) {
    throw new TooManyRequestsError('查詢次數過多，請稍後再試。');
  }
};

export const enforcePublicLookupRateLimit = async (
  event: H3Event,
  supabase: ServiceRoleSupabaseClient,
  input: {
    normalizedPhone: string;
    paperOrderNo: string;
  },
) => {
  const ip = getRateLimitClientIp(event);
  await enforcePublicRateLimit(supabase, {
    key: buildPublicLookupIpRateLimitKey({ ip }),
    limit: PUBLIC_LOOKUP_IP_RATE_LIMIT,
    windowSeconds: PUBLIC_LOOKUP_RATE_WINDOW_SECONDS,
  });
  await enforcePublicRateLimit(supabase, {
    key: buildPublicLookupRateLimitKey({ ip, ...input }),
    limit: PUBLIC_LOOKUP_RATE_LIMIT,
    windowSeconds: PUBLIC_LOOKUP_RATE_WINDOW_SECONDS,
  });
};

export const enforcePublicLineBindRateLimit = async (
  event: H3Event,
  supabase: ServiceRoleSupabaseClient,
) => {
  const ip = getRateLimitClientIp(event);
  await enforcePublicRateLimit(supabase, {
    key: buildPublicLineBindRateLimitKey({ ip }),
    limit: PUBLIC_LOOKUP_RATE_LIMIT,
    windowSeconds: PUBLIC_LOOKUP_RATE_WINDOW_SECONDS,
  });
};
