import { describe, expect, it } from 'vitest';
import { buildLineLiffLoginRedirectUri } from '../../app/utils/line-liff';
import { extractLineOrderGateToken } from '../../app/utils/line-order-gate-token';

describe('LINE LIFF login redirect', () => {
  it('builds an absolute canonical order-gate redirect URI from the current origin', () => {
    const redirectUri = buildLineLiffLoginRedirectUri(
      'bind-token',
      'https://status.surfboards-reborn.com',
    );

    expect(redirectUri).toBe('https://status.surfboards-reborn.com/line/order-gate?t=bind-token');
    expect(redirectUri).not.toContain('/line/order-gate/line/order-gate');
  });

  it('preserves and encodes the bind token in the login redirect URI', () => {
    const redirectUri = buildLineLiffLoginRedirectUri(
      'token with+symbols',
      'https://status.surfboards-reborn.com',
    );

    expect(new URL(redirectUri).searchParams.get('t')).toBe('token with+symbols');
    expect(extractLineOrderGateToken({}, redirectUri)).toBe('token with+symbols');
  });

  it('does not duplicate order-gate when the current browser path is already order-gate', () => {
    const redirectUri = buildLineLiffLoginRedirectUri(
      'bind-token',
      new URL('https://status.surfboards-reborn.com/line/order-gate').origin,
    );

    expect(redirectUri).toBe('https://status.surfboards-reborn.com/line/order-gate?t=bind-token');
    expect(redirectUri).not.toContain('/line/order-gate/line/order-gate');
  });
});
