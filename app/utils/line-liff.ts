import { normalizeLineOrderGateTokenValue } from './line-order-gate-token';

interface LineLiffDebugHooks {
  onInitState?: (state: string) => void;
  onIsLoggedIn?: (isLoggedIn: boolean) => void;
  onLoginRedirectUri?: (redirectUri: string) => void;
  onStep?: (step: string) => void;
}

interface LineLiffClient {
  getAccessToken: () => string | null;
  getIDToken: () => string | null;
  init: (options: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  login: (options: { redirectUri: string }) => void;
}

interface LineLiffTokenOptions {
  debug?: boolean;
  loadLiff?: () => Promise<LineLiffClient>;
  redirectOrigin?: string;
}

export const buildLineLiffLoginRedirectUri = (
  token: string,
  origin = window.location.origin,
  options: { debug?: boolean } = {},
) => {
  const normalizedToken = normalizeLineOrderGateTokenValue(token);
  if (!normalizedToken) throw new Error('LINE 綁定連結缺少 token，請重新掃描 QR Code。');
  const url = new URL('/line/order-gate', origin);
  url.searchParams.set('t', normalizedToken);
  if (options.debug) url.searchParams.set('debug', '1');
  return url.toString();
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

  debugHooks.onStep?.('before_liff_import');
  const liff =
    options.loadLiff !== undefined
      ? await options.loadLiff()
      : ((await import('@line/liff')).default as LineLiffClient);
  debugHooks.onStep?.('before_liff_init');
  debugHooks.onInitState?.('initializing');
  await liff.init({ liffId: normalizedLiffId });
  debugHooks.onStep?.('after_liff_init');
  debugHooks.onInitState?.('success');

  debugHooks.onStep?.('before_is_logged_in');
  const isLoggedIn = liff.isLoggedIn();
  debugHooks.onIsLoggedIn?.(isLoggedIn);
  if (!isLoggedIn) {
    const redirectUri = buildLineLiffLoginRedirectUri(
      normalizedToken,
      options.redirectOrigin ?? window.location.origin,
      {
        debug: options.debug ?? debugHooks.onStep !== undefined,
      },
    );
    debugHooks.onLoginRedirectUri?.(redirectUri);
    debugHooks.onStep?.('before_liff_login');
    debugHooks.onStep?.('liff_login_redirect');
    liff.login({ redirectUri });
    return null;
  }

  debugHooks.onStep?.('before_get_id_token');
  const idToken = liff.getIDToken();
  if (!idToken) throw new Error('無法取得 LINE 登入資訊，請使用 LINE 重新開啟。');
  debugHooks.onStep?.('after_get_id_token');

  return {
    accessToken: liff.getAccessToken() || undefined,
    idToken,
  };
};
