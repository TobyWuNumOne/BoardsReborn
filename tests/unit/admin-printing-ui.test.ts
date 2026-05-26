import { describe, expect, it } from 'vitest';
import {
  getPrintDeviceConnectionState,
  getPrintDeviceConnectionStateLabel,
  getPrintDeviceConnectionStateTone,
} from '../../app/utils/admin-printing';

describe('admin printing UI helpers', () => {
  const now = new Date('2026-05-26T01:00:00.000Z');

  it('derives device connection state from status and heartbeat freshness', () => {
    expect(
      getPrintDeviceConnectionState({
        lastSeenAt: '2026-05-26T01:00:00.000Z',
        now,
        staleAfterSeconds: 30,
        status: 'active',
      }),
    ).toBe('online');

    expect(
      getPrintDeviceConnectionState({
        lastSeenAt: '2026-05-26T00:59:50.000Z',
        now,
        staleAfterSeconds: 30,
        status: 'active',
      }),
    ).toBe('online');

    expect(
      getPrintDeviceConnectionState({
        lastSeenAt: '2026-05-26T00:59:30.000Z',
        now,
        staleAfterSeconds: 30,
        status: 'active',
      }),
    ).toBe('online');

    expect(
      getPrintDeviceConnectionState({
        lastSeenAt: '2026-05-26T00:59:29.999Z',
        now,
        staleAfterSeconds: 30,
        status: 'active',
      }),
    ).toBe('stale');

    expect(
      getPrintDeviceConnectionState({
        lastSeenAt: '2026-05-26T00:59:29.000Z',
        now,
        staleAfterSeconds: 30,
        status: 'active',
      }),
    ).toBe('stale');

    expect(
      getPrintDeviceConnectionState({
        lastSeenAt: null,
        now,
        staleAfterSeconds: 30,
        status: 'active',
      }),
    ).toBe('offline');

    expect(
      getPrintDeviceConnectionState({
        lastSeenAt: 'not-a-date',
        now,
        staleAfterSeconds: 30,
        status: 'active',
      }),
    ).toBe('offline');

    expect(
      getPrintDeviceConnectionState({
        lastSeenAt: '2026-05-26T01:00:10.000Z',
        now,
        staleAfterSeconds: 30,
        status: 'active',
      }),
    ).toBe('online');

    expect(
      getPrintDeviceConnectionState({
        lastSeenAt: '2026-05-26T00:59:59.000Z',
        now,
        staleAfterSeconds: 30,
        status: 'inactive',
      }),
    ).toBe('inactive');

    expect(
      getPrintDeviceConnectionState({
        lastSeenAt: '2026-05-26T00:59:59.000Z',
        now,
        staleAfterSeconds: 30,
        status: 'error',
      }),
    ).toBe('error');
  });

  it('supports custom staleness windows', () => {
    expect(
      getPrintDeviceConnectionState({
        lastSeenAt: '2026-05-26T00:59:40.000Z',
        now,
        staleAfterSeconds: 20,
        status: 'active',
      }),
    ).toBe('online');

    expect(
      getPrintDeviceConnectionState({
        lastSeenAt: '2026-05-26T00:59:39.999Z',
        now,
        staleAfterSeconds: 20,
        status: 'active',
      }),
    ).toBe('stale');
  });

  it('maps connection states to display labels and tones', () => {
    expect(getPrintDeviceConnectionStateLabel('online')).toBe('在線');
    expect(getPrintDeviceConnectionStateLabel('offline')).toBe('離線');
    expect(getPrintDeviceConnectionStateLabel('stale')).toBe('心跳過期');
    expect(getPrintDeviceConnectionStateLabel('inactive')).toBe('停用');
    expect(getPrintDeviceConnectionStateLabel('error')).toBe('錯誤');

    expect(getPrintDeviceConnectionStateTone('online')).toBe('success');
    expect(getPrintDeviceConnectionStateTone('offline')).toBe('inactive');
    expect(getPrintDeviceConnectionStateTone('stale')).toBe('warning');
    expect(getPrintDeviceConnectionStateTone('inactive')).toBe('inactive');
    expect(getPrintDeviceConnectionStateTone('error')).toBe('danger');
  });
});
