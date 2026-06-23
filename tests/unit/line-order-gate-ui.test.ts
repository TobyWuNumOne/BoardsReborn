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
      'liffInitState',
      'computed loginRedirectUri',
      'loginRedirectUriHasTokenValue',
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
    expect(pageSource).toContain('redirectOrigin: statusOrigin()');
    expect(pageSource).not.toContain('lineUserId');
  });
});
