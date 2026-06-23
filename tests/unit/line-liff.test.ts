import { describe, expect, it } from 'vitest';
import { buildLineLiffLoginRedirectUri, getLineLiffTokens } from '../../app/utils/line-liff';
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

  it('preserves the debug flag when requested', () => {
    const redirectUri = buildLineLiffLoginRedirectUri(
      'bind-token',
      'https://status.surfboards-reborn.com',
      { debug: true },
    );

    const url = new URL(redirectUri);
    expect(url.searchParams.get('t')).toBe('bind-token');
    expect(url.searchParams.get('debug')).toBe('1');
  });

  it('requires a non-empty token before building a login redirect URI', () => {
    expect(() => buildLineLiffLoginRedirectUri('', 'https://status.surfboards-reborn.com')).toThrow(
      'LINE 綁定連結缺少 token',
    );
  });

  it('uses the provided status origin instead of the LIFF origin', () => {
    const redirectUri = buildLineLiffLoginRedirectUri(
      'bind-token',
      'https://status.surfboards-reborn.com',
    );

    expect(redirectUri).toBe('https://status.surfboards-reborn.com/line/order-gate?t=bind-token');
    expect(redirectUri).not.toBe('https://liff.line.me/2010462177-RsNE4cwl?t');
    expect(new URL(redirectUri).hostname).toBe('status.surfboards-reborn.com');
  });

  it('does not call login when LIFF is already logged in', async () => {
    const calls: string[] = [];
    let loginCalledWith = '';
    const tokens = await getLineLiffTokens(
      'liff-id',
      'resolved-token',
      {
        onIsLoggedIn: (value) => calls.push(`logged-in:${value}`),
        onStep: (value) => calls.push(value),
      },
      {
        loadLiff: async () => ({
          getAccessToken: () => 'access-token',
          getIDToken: () => 'id-token',
          init: async () => {
            calls.push('init-called');
          },
          isLoggedIn: () => true,
          login: ({ redirectUri }) => {
            loginCalledWith = redirectUri;
          },
        }),
        redirectOrigin: 'https://status.surfboards-reborn.com',
      },
    );

    expect(tokens).toEqual({ accessToken: 'access-token', idToken: 'id-token' });
    expect(loginCalledWith).toBe('');
    expect(calls).toEqual([
      'before_liff_import',
      'before_liff_init',
      'init-called',
      'after_liff_init',
      'before_is_logged_in',
      'logged-in:true',
      'before_get_id_token',
      'after_get_id_token',
    ]);
  });

  it('calls login only when LIFF is not logged in and preserves the resolved token', async () => {
    const steps: string[] = [];
    let loginCalledWith = '';
    const tokens = await getLineLiffTokens(
      'liff-id',
      'resolved-token',
      {
        onLoginRedirectUri: (value) => steps.push(`redirect:${value}`),
        onStep: (value) => steps.push(value),
      },
      {
        debug: true,
        loadLiff: async () => ({
          getAccessToken: () => null,
          getIDToken: () => null,
          init: async () => undefined,
          isLoggedIn: () => false,
          login: ({ redirectUri }) => {
            loginCalledWith = redirectUri;
          },
        }),
        redirectOrigin: 'https://status.surfboards-reborn.com',
      },
    );

    expect(tokens).toBeNull();
    const redirectUrl = new URL(loginCalledWith);
    expect(redirectUrl.origin).toBe('https://status.surfboards-reborn.com');
    expect(redirectUrl.pathname).toBe('/line/order-gate');
    expect(redirectUrl.searchParams.get('t')).toBe('resolved-token');
    expect(redirectUrl.searchParams.get('debug')).toBe('1');
    expect(loginCalledWith).not.toContain('/line/order-gate/line/order-gate');
    expect(loginCalledWith).not.toBe('https://liff.line.me/2010462177-RsNE4cwl?t');
    expect(steps).toContain(`redirect:${loginCalledWith}`);
    expect(steps).toContain('before_liff_login');
    expect(steps).toContain('liff_login_redirect');
  });

  it('does not import LIFF or call login when the resolved token is missing', async () => {
    let loadCalled = false;

    await expect(
      getLineLiffTokens(
        'liff-id',
        '',
        {},
        {
          loadLiff: async () => {
            loadCalled = true;
            throw new Error('should not load');
          },
          redirectOrigin: 'https://status.surfboards-reborn.com',
        },
      ),
    ).rejects.toThrow('LINE 綁定連結缺少 token');
    expect(loadCalled).toBe(false);
  });
});
