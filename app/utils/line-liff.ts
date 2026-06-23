import { normalizeLineOrderGateTokenValue } from './line-order-gate-token';

interface LineLiffDebugHooks {
  onInitState?: (state: string) => void;
  onIsLoggedIn?: (isLoggedIn: boolean) => void;
  onLoginRedirectUri?: (redirectUri: string) => void;
  onStep?: (step: string) => void;
}

interface LineLiffTokenOptions {
  debug?: boolean;
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

  debugHooks.onStep?.('liff_import_start');
  const { default: liff } = await import('@line/liff');
  debugHooks.onStep?.('liff_init_start');
  debugHooks.onInitState?.('initializing');
  await liff.init({ liffId: normalizedLiffId });
  debugHooks.onStep?.('liff_init_success');
  debugHooks.onInitState?.('success');

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
    debugHooks.onStep?.('liff_login_redirect');
    liff.login({ redirectUri });
    return null;
  }

  debugHooks.onStep?.('liff_get_id_token');
  const idToken = liff.getIDToken();
  if (!idToken) throw new Error('無法取得 LINE 登入資訊，請使用 LINE 重新開啟。');

  debugHooks.onStep?.('liff_tokens_ready');
  return {
    accessToken: liff.getAccessToken() || undefined,
    idToken,
  };
};
