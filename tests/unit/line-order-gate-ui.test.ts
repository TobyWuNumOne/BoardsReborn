import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(resolve(process.cwd(), 'app/pages/line/order-gate.vue'), 'utf8');
const liffSource = readFileSync(resolve(process.cwd(), 'app/utils/line-liff.ts'), 'utf8');

describe('LINE order gate UI contract', () => {
  it('renders all MVP states without exposing customer-sensitive fields', () => {
    for (const stateText of [
      '綁定 LINE 接收通知',
      '此 QR 的 LINE 綁定程序已完成',
      '綁定連結已過期',
      '綁定連結已失效',
      '無效的綁定連結',
      '已完成 LINE 綁定',
      '請聯絡店家協助解除舊綁定並重新發卡',
      'LINE 服務暫時無法使用',
      '查詢維修進度',
      '仍需輸入工單號與完整手機號碼',
      'LINE debug',
      'tokenSource',
      'tokenPreview',
      'resolvedTokenLength',
      'bindClickStarted',
      'bindClickDryRun',
      'bindClickTokenExists',
      'bindClickTokenLength',
      'bindClickTokenPreview',
      'bindClickDebugEnabled',
      'beforeLiffLogin',
      'hasHashAccessToken',
      'hasHashIdToken',
      'hasLiffHashAccessToken',
      'hasLiffHashIdToken',
      'usedHashIdTokenFallback',
      'liffInitState',
      'computed loginRedirectUri',
      'loginRedirectUriHasTokenValue',
      'loginRedirectUriHost',
      'loginRedirectUriPath',
      'loginRedirectUriSearchKeys',
      'nextAction.callLiffInit',
      'nextAction.callLiffLogin',
      'nextAction.callGetIDToken',
      'nextAction.callConfirmAPI',
      'confirmApiCalled',
      'confirmApiStatus',
      'confirmApiErrorCode',
    ]) {
      expect(pageSource).toContain(stateText);
    }
    expect(pageSource).not.toContain('customer.phone');
    expect(pageSource).not.toContain('customer.name');
    expect(pageSource).not.toContain('line_user_id');
    expect(pageSource).not.toContain('LINE_CHANNEL_ACCESS_TOKEN');
    expect(pageSource).not.toContain('LINE_CHANNEL_SECRET');
  });

  it('does not automatically redirect to repair status after binding', () => {
    expect(pageSource).not.toMatch(/navigateTo\(['"]\/repair-status/);
    expect(pageSource).not.toMatch(/router\.(push|replace)\(['"]\/repair-status/);
  });

  it('uses LIFF tokens only in memory and never sends a client user ID', () => {
    expect(liffSource).toContain('liff.init');
    expect(liffSource).toContain('liff.login');
    expect(liffSource).toContain('liff.getIDToken');
    expect(liffSource).toContain('liff.getAccessToken');
    expect(liffSource).toContain("new URL('/line/order-gate'");
    expect(liffSource).toContain("url.searchParams.set('t'");
    expect(liffSource).toContain("url.searchParams.set('debug'");
    expect(liffSource).not.toContain('window.location.href');
    expect(liffSource).not.toContain('localStorage');
    expect(liffSource).not.toContain('sessionStorage');
    expect(liffSource).not.toContain('getProfile');
    expect(pageSource).toContain('getLineLiffTokens(');
    expect(pageSource).toContain('extractLiffTokensFromHash(window.location.hash)');
    expect(pageSource).toContain('config.public.liffId');
    expect(pageSource).toContain('resolvedToken.value');
    expect(pageSource).toContain('bind_missing_resolved_token');
    expect(pageSource).toContain('before_hash_id_token_confirm');
    expect(pageSource).toContain('confirmLineBinding(bindToken');
    expect(pageSource).toContain('dry_run_ready');
    expect(pageSource).toContain('dryRunEnabled.value');
    expect(pageSource).toContain('debugVisible');
    expect(pageSource).toContain('lastClickDebugRows.value.length > 0');
    expect(pageSource).not.toContain('route.query.t)');
    expect(pageSource).toContain('redirectOrigin: statusOrigin()');
    expect(pageSource).not.toContain('lineUserId');
  });

  it('keeps debug observability production-safe during the LIFF click flow', () => {
    for (const diagnostic of [
      'before_liff_import',
      'before_liff_init',
      'after_liff_init',
      'before_is_logged_in',
      'before_liff_login',
      'liff_login_redirect',
      'liff_logged_in_mismatch',
      'before_get_id_token',
      'after_get_id_token',
      'before_confirm_api',
      'after_confirm_api',
      'LIFF_LOGGED_IN_MISMATCH',
      'MISSING_RESOLVED_TOKEN',
      'access_token',
      'id_token',
      'context_token',
      'feature_token',
      'mst_challenge',
    ]) {
      expect(`${pageSource}\n${liffSource}`).toContain(diagnostic);
    }

    expect(pageSource).toContain('maskSearchParams');
    expect(pageSource).toContain("params.set(key, '[masked]')");
    expect(pageSource).toContain('sessionStorage.setItem(clickDebugStorageKey');
    expect(pageSource).toContain('sessionStorage.getItem(clickDebugStorageKey');
    expect(pageSource).toContain('computedLoginRedirectUriMasked');
    expect(pageSource).toContain('lastClick.');
    expect(pageSource).toContain('nextActionCallLiffLogin');
    expect(pageSource).toContain('nextActionCallGetIdToken');
    expect(pageSource).toContain('nextActionCallLiffInit');
    expect(pageSource).toContain('nextActionCallConfirmApi');
    expect(pageSource).toContain('usedHashIdTokenFallback');
    expect(pageSource).not.toContain('sessionStorage.setItem(clickDebugStorageKey, bindToken');
    expect(pageSource).not.toContain('sessionStorage.setItem(clickDebugStorageKey, token');
    expect(pageSource).not.toContain('sessionStorage.setItem(clickDebugStorageKey, idToken');
    expect(pageSource).not.toContain('sessionStorage.setItem(clickDebugStorageKey, accessToken');
    expect(pageSource).not.toContain('raw profile');
    expect(pageSource).not.toContain('LINE_CHANNEL_ACCESS_TOKEN');
    expect(pageSource).not.toContain('LINE_CHANNEL_SECRET');
  });

  it('does not contain a LIFF-base login redirect branch', () => {
    expect(liffSource).toContain('liff.login({ redirectUri })');
    expect(liffSource).toContain("new URL('/line/order-gate'");
    expect(liffSource).not.toContain('new URL(`https://liff.line.me');
    expect(liffSource).not.toContain('createUrlBy');
    expect(liffSource).not.toContain('permanentLink');
    expect(liffSource).not.toContain('liff.login()');
    expect(liffSource).not.toContain('?t`');
    expect(liffSource).not.toContain('?t=');
  });

  it('prefers the transient LIFF hash id token before initializing the LIFF SDK', () => {
    const hashBranchIndex = pageSource.indexOf('if (hashTokens.idToken)');
    const hashConfirmIndex = pageSource.indexOf('confirmLineBinding(bindToken', hashBranchIndex);
    const sdkFlowIndex = pageSource.indexOf('getLineLiffTokens(', hashBranchIndex);

    expect(hashBranchIndex).toBeGreaterThan(-1);
    expect(hashConfirmIndex).toBeGreaterThan(hashBranchIndex);
    expect(sdkFlowIndex).toBeGreaterThan(hashConfirmIndex);
    expect(pageSource).toContain("debugState.nextActionCallLiffInit = 'false'");
    expect(pageSource).toContain("debugState.nextActionCallLiffLogin = 'false'");
    expect(pageSource).toContain("debugState.nextActionCallGetIdToken = 'false'");
    expect(pageSource).toContain("debugState.nextActionCallConfirmApi = 'true'");
    expect(pageSource).not.toContain('line_user_id');
    expect(pageSource).not.toContain('getProfile');
  });
});
