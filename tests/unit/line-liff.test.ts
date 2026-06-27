import { describe, expect, it } from 'vitest';
import {
  buildOrderGateUrl,
  buildLineLiffLoginRedirectUri,
  extractLiffTokensFromHash,
  getLineLiffTokens,
  initLineLiff,
} from '../../app/utils/line-liff';
import { extractLineOrderGateToken } from '../../app/utils/line-order-gate-token';

describe('LINE LIFF login redirect', () => {
  it('extracts LIFF id and access tokens from the URL hash', () => {
    expect(extractLiffTokensFromHash('#access_token=access-token&id_token=id-token')).toEqual({
      accessToken: 'access-token',
      idToken: 'id-token',
    });
    expect(extractLiffTokensFromHash('#/access_token=access-token&id_token=id-token')).toEqual({
      accessToken: 'access-token',
      idToken: 'id-token',
    });
  });

  it('does not extract LINE profile or user id details from the URL hash', () => {
    expect(
      extractLiffTokensFromHash(
        '#access_token=access-token&id_token=id-token&line_user_id=user-id&displayName=Customer',
      ),
    ).toEqual({
      accessToken: 'access-token',
      idToken: 'id-token',
    });
  });

  it('builds an absolute canonical order-gate redirect URI from the current origin', () => {
    const redirectUri = buildOrderGateUrl(
      'bind-token',
      false,
      'https://status.surfboards-reborn.com',
    );

    expect(redirectUri).toBe('https://status.surfboards-reborn.com/line/order-gate?t=bind-token');
    expect(redirectUri).not.toContain('/line/order-gate/line/order-gate');
  });

  it('preserves and encodes the bind token in the login redirect URI', () => {
    const redirectUri = buildOrderGateUrl(
      'token with+symbols',
      false,
      'https://status.surfboards-reborn.com',
    );

    expect(new URL(redirectUri).searchParams.get('t')).toBe('token with+symbols');
    expect(extractLineOrderGateToken({}, redirectUri)).toBe('token with+symbols');
  });

  it('does not duplicate order-gate when the current browser path is already order-gate', () => {
    const redirectUri = buildOrderGateUrl(
      'bind-token',
      false,
      new URL('https://status.surfboards-reborn.com/line/order-gate').origin,
    );

    expect(redirectUri).toBe('https://status.surfboards-reborn.com/line/order-gate?t=bind-token');
    expect(redirectUri).not.toContain('/line/order-gate/line/order-gate');
  });

  it('preserves the debug flag when requested', () => {
    const redirectUri = buildOrderGateUrl(
      'bind-token',
      true,
      'https://status.surfboards-reborn.com',
    );

    const url = new URL(redirectUri);
    expect(url.searchParams.get('t')).toBe('bind-token');
    expect(url.searchParams.get('debug')).toBe('1');
  });

  it('requires a non-empty token before building a login redirect URI', () => {
    expect(() => buildOrderGateUrl('', false, 'https://status.surfboards-reborn.com')).toThrow(
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
    const initStates: string[] = [];
    let loginCalledWith = '';
    const tokens = await getLineLiffTokens(
      'liff-id',
      'resolved-token',
      {
        onInitState: (value) => initStates.push(value),
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
    expect(initStates).toEqual(['initializing', 'initialized']);
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

  it('can request friendship before reading LIFF tokens when already logged in', async () => {
    const calls: string[] = [];
    const tokens = await getLineLiffTokens(
      'liff-id',
      'resolved-token',
      {
        onFriendshipPrompt: (value) => calls.push(`friendship:${value}`),
        onStep: (value) => calls.push(value),
      },
      {
        loadLiff: async () => ({
          getAccessToken: () => {
            calls.push('get-access-token');
            return 'access-token';
          },
          getIDToken: () => {
            calls.push('get-id-token');
            return 'id-token';
          },
          init: async () => {
            calls.push('init-called');
          },
          isLoggedIn: () => true,
          login: () => {
            throw new Error('login should not be called');
          },
          requestFriendship: async () => {
            calls.push('request-friendship');
          },
        }),
        redirectOrigin: 'https://status.surfboards-reborn.com',
        requestFriendshipBeforeToken: true,
      },
    );

    expect(tokens).toEqual({ accessToken: 'access-token', idToken: 'id-token' });
    expect(calls).toEqual([
      'before_liff_import',
      'before_liff_init',
      'init-called',
      'after_liff_init',
      'before_is_logged_in',
      'friendship:attempted',
      'request-friendship',
      'friendship:completed',
      'before_get_id_token',
      'get-id-token',
      'after_get_id_token',
      'get-access-token',
    ]);
  });

  it('continues token extraction when requestFriendship fails', async () => {
    const friendshipStates: string[] = [];
    const tokens = await getLineLiffTokens(
      'liff-id',
      'resolved-token',
      {
        onFriendshipPrompt: (value) => friendshipStates.push(value),
      },
      {
        loadLiff: async () => ({
          getAccessToken: () => null,
          getIDToken: () => 'id-token',
          init: async () => undefined,
          isLoggedIn: () => true,
          login: () => {
            throw new Error('login should not be called');
          },
          requestFriendship: async () => {
            throw new Error('user cancelled');
          },
        }),
        requestFriendshipBeforeToken: true,
      },
    );

    expect(tokens).toEqual({ idToken: 'id-token' });
    expect(friendshipStates).toEqual(['attempted', 'failed']);
  });

  it('continues token extraction when requestFriendship is unavailable', async () => {
    const friendshipStates: string[] = [];
    const tokens = await getLineLiffTokens(
      'liff-id',
      'resolved-token',
      {
        onFriendshipPrompt: (value) => friendshipStates.push(value),
      },
      {
        loadLiff: async () => ({
          getAccessToken: () => null,
          getIDToken: () => 'id-token',
          init: async () => undefined,
          isLoggedIn: () => true,
          login: () => {
            throw new Error('login should not be called');
          },
        }),
        requestFriendshipBeforeToken: true,
      },
    );

    expect(tokens).toEqual({ idToken: 'id-token' });
    expect(friendshipStates).toEqual(['unavailable']);
  });

  it('can initialize LIFF for the primary redirect without login or token lookup work', async () => {
    const calls: string[] = [];
    const initStates: string[] = [];
    let loginCalled = false;
    const liff = await initLineLiff(
      'liff-id',
      {
        onInitState: (value) => initStates.push(value),
        onStep: (value) => calls.push(value),
      },
      {
        loadLiff: async () => ({
          getAccessToken: () => null,
          getIDToken: () => null,
          init: async () => {
            calls.push('init-called');
          },
          isLoggedIn: () => {
            calls.push('is-logged-in-called');
            return false;
          },
          login: () => {
            loginCalled = true;
          },
        }),
      },
    );

    expect(liff).toBeTruthy();
    expect(loginCalled).toBe(false);
    expect(initStates).toEqual(['initializing', 'initialized']);
    expect(calls).toEqual([
      'before_liff_import',
      'before_liff_init',
      'init-called',
      'after_liff_init',
    ]);
  });

  it('reports primary redirect LIFF init failure without calling login', async () => {
    const initStates: string[] = [];
    let loginCalled = false;

    await expect(
      initLineLiff(
        'liff-id',
        {
          onInitState: (value) => initStates.push(value),
        },
        {
          loadLiff: async () => ({
            getAccessToken: () => null,
            getIDToken: () => null,
            init: async () => {
              throw new Error('init failed');
            },
            isLoggedIn: () => true,
            login: () => {
              loginCalled = true;
            },
          }),
        },
      ),
    ).rejects.toMatchObject({ code: 'LIFF_INIT_FAILED' });

    expect(initStates).toEqual(['initializing', 'failed']);
    expect(loginCalled).toBe(false);
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
    const expectedRedirectUri = buildOrderGateUrl(
      'resolved-token',
      true,
      'https://status.surfboards-reborn.com',
    );
    const redirectUrl = new URL(loginCalledWith);
    expect(loginCalledWith).toBe(expectedRedirectUri);
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

  it('does not request friendship before redirecting a logged-out LIFF user', async () => {
    let requestFriendshipCalled = false;
    let loginCalledWith = '';
    const tokens = await getLineLiffTokens(
      'liff-id',
      'resolved-token',
      {},
      {
        loadLiff: async () => ({
          getAccessToken: () => null,
          getIDToken: () => null,
          init: async () => undefined,
          isLoggedIn: () => false,
          login: ({ redirectUri }) => {
            loginCalledWith = redirectUri;
          },
          requestFriendship: async () => {
            requestFriendshipCalled = true;
          },
        }),
        redirectOrigin: 'https://status.surfboards-reborn.com',
        requestFriendshipBeforeToken: true,
      },
    );

    expect(tokens).toBeNull();
    expect(requestFriendshipCalled).toBe(false);
    expect(loginCalledWith).toBe(
      'https://status.surfboards-reborn.com/line/order-gate?t=resolved-token',
    );
  });

  it('does not call login when LIFF hash tokens exist but the SDK reports logged out', async () => {
    const steps: string[] = [];
    let loginCalledWith = '';

    await expect(
      getLineLiffTokens(
        'liff-id',
        'resolved-token',
        {
          onIsLoggedIn: (value) => steps.push(`logged-in:${value}`),
          onStep: (value) => steps.push(value),
        },
        {
          hasLiffHashTokens: true,
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
      ),
    ).rejects.toMatchObject({ code: 'LIFF_LOGGED_IN_MISMATCH' });

    expect(loginCalledWith).toBe('');
    expect(steps).toContain('logged-in:false');
    expect(steps).toContain('liff_logged_in_mismatch');
    expect(steps).not.toContain('before_liff_login');
    expect(steps).not.toContain('liff_login_redirect');
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

  it('reports LIFF init failure without calling login', async () => {
    const initStates: string[] = [];
    let loginCalled = false;

    await expect(
      getLineLiffTokens(
        'liff-id',
        'resolved-token',
        {
          onInitState: (value) => initStates.push(value),
        },
        {
          loadLiff: async () => ({
            getAccessToken: () => null,
            getIDToken: () => null,
            init: async () => {
              throw new Error('init failed');
            },
            isLoggedIn: () => true,
            login: () => {
              loginCalled = true;
            },
          }),
          redirectOrigin: 'https://status.surfboards-reborn.com',
        },
      ),
    ).rejects.toMatchObject({ code: 'LIFF_INIT_FAILED' });

    expect(initStates).toEqual(['initializing', 'failed']);
    expect(loginCalled).toBe(false);
  });

  it('reports missing LIFF ID token after logged-in SDK state', async () => {
    let loginCalled = false;

    await expect(
      getLineLiffTokens(
        'liff-id',
        'resolved-token',
        {},
        {
          loadLiff: async () => ({
            getAccessToken: () => 'access-token',
            getIDToken: () => null,
            init: async () => undefined,
            isLoggedIn: () => true,
            login: () => {
              loginCalled = true;
            },
          }),
          redirectOrigin: 'https://status.surfboards-reborn.com',
        },
      ),
    ).rejects.toMatchObject({ code: 'LIFF_ID_TOKEN_MISSING' });

    expect(loginCalled).toBe(false);
  });
});
