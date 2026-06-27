import { normalizeLineOrderGateTokenValue } from './line-order-gate-token';

export interface LineLiffDebugHooks {
  onFriendshipPrompt?: (state: string) => void;
  onInitState?: (state: string) => void;
  onIsLoggedIn?: (isLoggedIn: boolean) => void;
  onLoginRedirectUri?: (redirectUri: string) => void;
  onStep?: (step: string) => void;
}

export interface LineLiffClient {
  getAccessToken: () => string | null;
  getIDToken: () => string | null;
  init: (options: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  login: (options: { redirectUri: string }) => void;
  requestFriendship?: () => Promise<void>;
}

interface LineLiffTokenOptions {
  debug?: boolean;
  hasLiffHashTokens?: boolean;
  loadLiff?: () => Promise<LineLiffClient>;
  redirectOrigin?: string;
  requestFriendshipBeforeToken?: boolean;
}

interface LineLiffInitOptions {
  loadLiff?: () => Promise<LineLiffClient>;
}

export interface LineLiffTokens {
  accessToken?: string;
  idToken: string;
}

const createLineLiffError = (code: string, message: string) => {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
};

export const extractLiffTokensFromHash = (hash: string): Partial<LineLiffTokens> => {
  const normalizedHash = hash.trim().replace(/^#\/?/, '');
  if (!normalizedHash) return {};

  const params = new URLSearchParams(normalizedHash);
  const idToken = params.get('id_token')?.trim() || undefined;
  const accessToken = params.get('access_token')?.trim() || undefined;

  return {
    ...(accessToken ? { accessToken } : {}),
    ...(idToken ? { idToken } : {}),
  };
};

export const buildOrderGateUrl = (
  token: string,
  debugEnabled = false,
  origin = window.location.origin,
) => {
  const normalizedToken = normalizeLineOrderGateTokenValue(token);
  if (!normalizedToken) throw new Error('LINE 綁定連結缺少 token，請重新掃描 QR Code。');
  const url = new URL('/line/order-gate', origin);
  url.searchParams.set('t', normalizedToken);
  if (debugEnabled) url.searchParams.set('debug', '1');
  return url.toString();
};

export const buildLineLiffLoginRedirectUri = (
  token: string,
  origin = window.location.origin,
  options: { debug?: boolean } = {},
) => buildOrderGateUrl(token, Boolean(options.debug), origin);

export const initLineLiff = async (
  liffId: string,
  debugHooks: LineLiffDebugHooks = {},
  options: LineLiffInitOptions = {},
) => {
  const normalizedLiffId = liffId.trim();
  if (!normalizedLiffId) throw new Error('LIFF ID 尚未設定，請聯絡店家。');

  debugHooks.onStep?.('before_liff_import');
  const liff =
    options.loadLiff !== undefined
      ? await options.loadLiff()
      : ((await import('@line/liff')).default as LineLiffClient);
  debugHooks.onStep?.('before_liff_init');
  debugHooks.onInitState?.('initializing');
  try {
    await liff.init({ liffId: normalizedLiffId });
  } catch (error) {
    debugHooks.onInitState?.('failed');
    throw createLineLiffError(
      'LIFF_INIT_FAILED',
      error instanceof Error ? error.message : 'LIFF 初始化失敗，請重新開啟此頁。',
    );
  }
  debugHooks.onStep?.('after_liff_init');
  debugHooks.onInitState?.('initialized');
  return liff;
};

export const getLineLiffTokens = async (
  liffId: string,
  token: string,
  debugHooks: LineLiffDebugHooks = {},
  options: LineLiffTokenOptions = {},
) => {
  const normalizedLiffId = liffId.trim();
  if (!normalizedLiffId) throw new Error('LIFF ID 尚未設定，請聯絡店家。');
  const normalizedToken = normalizeLineOrderGateTokenValue(token);
  if (!normalizedToken) throw new Error('LINE 綁定連結缺少 token，請重新掃描 QR Code。');

  const liff = await initLineLiff(normalizedLiffId, debugHooks, {
    loadLiff: options.loadLiff,
  });

  debugHooks.onStep?.('before_is_logged_in');
  const isLoggedIn = liff.isLoggedIn();
  debugHooks.onIsLoggedIn?.(isLoggedIn);
  if (!isLoggedIn) {
    if (options.hasLiffHashTokens) {
      debugHooks.onStep?.('liff_logged_in_mismatch');
      throw createLineLiffError(
        'LIFF_LOGGED_IN_MISMATCH',
        'LINE 登入狀態無法確認，請關閉後重新從 LINE 開啟。',
      );
    }

    const redirectUri = buildOrderGateUrl(
      normalizedToken,
      options.debug ?? debugHooks.onStep !== undefined,
      options.redirectOrigin ?? window.location.origin,
    );
    debugHooks.onLoginRedirectUri?.(redirectUri);
    debugHooks.onStep?.('before_liff_login');
    debugHooks.onStep?.('liff_login_redirect');
    liff.login({ redirectUri });
    return null;
  }

  if (options.requestFriendshipBeforeToken) {
    if (typeof liff.requestFriendship === 'function') {
      debugHooks.onFriendshipPrompt?.('attempted');
      try {
        await liff.requestFriendship();
        debugHooks.onFriendshipPrompt?.('completed');
      } catch {
        debugHooks.onFriendshipPrompt?.('failed');
      }
    } else {
      debugHooks.onFriendshipPrompt?.('unavailable');
    }
  }

  debugHooks.onStep?.('before_get_id_token');
  const idToken = liff.getIDToken();
  if (!idToken) {
    throw createLineLiffError(
      'LIFF_ID_TOKEN_MISSING',
      '無法取得 LINE 登入資訊，請使用 LINE 重新開啟。',
    );
  }
  debugHooks.onStep?.('after_get_id_token');

  return {
    accessToken: liff.getAccessToken() || undefined,
    idToken,
  };
};
