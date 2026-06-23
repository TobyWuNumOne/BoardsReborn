export const buildLineLiffLoginRedirectUri = (token: string, origin = window.location.origin) => {
  const url = new URL('/line/order-gate', origin);
  const trimmedToken = token.trim();
  if (trimmedToken) url.searchParams.set('t', trimmedToken);
  return url.toString();
};

export const getLineLiffTokens = async (liffId: string, token: string) => {
  const normalizedLiffId = liffId.trim();
  if (!normalizedLiffId) throw new Error('LIFF ID 尚未設定，請聯絡店家。');

  const { default: liff } = await import('@line/liff');
  await liff.init({ liffId: normalizedLiffId });

  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: buildLineLiffLoginRedirectUri(token) });
    return null;
  }

  const idToken = liff.getIDToken();
  if (!idToken) throw new Error('無法取得 LINE 登入資訊，請使用 LINE 重新開啟。');

  return {
    accessToken: liff.getAccessToken() || undefined,
    idToken,
  };
};
