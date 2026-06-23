import { describe, expect, it } from 'vitest';
import { extractLineOrderGateToken } from '../../app/utils/line-order-gate-token';

describe('LINE order-gate token extraction', () => {
  it('prefers the direct token query', () => {
    expect(
      extractLineOrderGateToken(
        {
          'liff.state': '/line/order-gate?t=state-token',
          t: 'direct-token',
        },
        '',
      ),
    ).toBe('direct-token');
  });

  it('extracts token from LINE liff.state path query', () => {
    expect(
      extractLineOrderGateToken(
        {
          'liff.state': '/line/order-gate?t=state-token',
        },
        '',
      ),
    ).toBe('state-token');
  });

  it('extracts token from encoded LINE liff.state', () => {
    expect(
      extractLineOrderGateToken(
        {
          'liff.state': encodeURIComponent('/line/order-gate?t=encoded-token'),
        },
        '',
      ),
    ).toBe('encoded-token');
  });

  it('extracts token from alternate liff_state query key', () => {
    expect(
      extractLineOrderGateToken(
        {
          liff_state: '/line/order-gate?t=alternate-token',
        },
        '',
      ),
    ).toBe('alternate-token');
  });

  it('falls back to the current URL and hash', () => {
    expect(
      extractLineOrderGateToken(
        {},
        'https://status.surfboards-reborn.com/line/order-gate?liff.state=%2Fline%2Forder-gate%3Ft%3Durl-token',
      ),
    ).toBe('url-token');
    expect(
      extractLineOrderGateToken(
        {},
        'https://status.surfboards-reborn.com/line/order-gate#/line/order-gate?t=hash-token',
      ),
    ).toBe('hash-token');
  });

  it('returns an empty token when no supported source exists', () => {
    expect(extractLineOrderGateToken({ 'liff.state': '/line/order-gate' }, '')).toBe('');
  });
});
