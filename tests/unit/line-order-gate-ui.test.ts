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
      'bindClickTokenExists',
      'bindClickTokenLength',
      'bindClickTokenPreview',
      'bindClickDebugEnabled',
      'hasLiffHashAccessToken',
      'hasLiffHashIdToken',
      'liffInitState',
      'computed loginRedirectUri',
      'loginRedirectUriHasTokenValue',
      'loginRedirectUriHost',
      'loginRedirectUriPath',
      'loginRedirectUriSearchKeys',
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
    expect(pageSource).toContain('config.public.liffId');
    expect(pageSource).toContain('resolvedToken.value');
    expect(pageSource).toContain('bind_missing_resolved_token');
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
      'before_get_id_token',
      'after_get_id_token',
      'before_confirm_api',
      'after_confirm_api',
      'LIFF_LOGGED_IN_MISMATCH',
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
    expect(pageSource).not.toContain('raw profile');
    expect(pageSource).not.toContain('LINE_CHANNEL_ACCESS_TOKEN');
    expect(pageSource).not.toContain('LINE_CHANNEL_SECRET');
  });
});
