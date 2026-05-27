import { describe, expect, it } from 'vitest';
import {
  createEmptyAdminPrintSummary,
  getAdminPrintActionLabel,
  getAdminPrintingCenterPath,
  getPrintDeviceConnectionState,
  getPrintDeviceConnectionStateLabel,
  getPrintDeviceConnectionStateTone,
} from '../../app/utils/admin-printing';
import {
  ADMIN_PRINTING_REALTIME_TOPICS,
  shouldRefreshAdminPrintingOnVisibility,
  shouldRunAdminPrintingFallbackRefresh,
} from '../../app/utils/admin-printing-realtime';

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

  it('keeps printing realtime topics explicit and refreshes stale or dirty views only', () => {
    expect(ADMIN_PRINTING_REALTIME_TOPICS).toEqual([
      'printing:jobs',
      'printing:devices',
      'printing:summary',
    ]);

    expect(
      shouldRefreshAdminPrintingOnVisibility({
        dirty: false,
        fallbackIntervalMs: 60_000,
        lastSyncedAt: 1_000,
        now: 61_000,
      }),
    ).toBe(true);

    expect(
      shouldRefreshAdminPrintingOnVisibility({
        dirty: true,
        fallbackIntervalMs: 60_000,
        lastSyncedAt: 10_000,
        now: 20_000,
      }),
    ).toBe(true);

    expect(
      shouldRefreshAdminPrintingOnVisibility({
        dirty: false,
        fallbackIntervalMs: 60_000,
        lastSyncedAt: 10_000,
        now: 20_000,
      }),
    ).toBe(false);

    expect(
      shouldRunAdminPrintingFallbackRefresh({
        dirty: true,
        fallbackIntervalMs: 60_000,
        isVisible: false,
        lastSyncedAt: 10_000,
        now: 20_000,
      }),
    ).toBe(false);

    expect(
      shouldRunAdminPrintingFallbackRefresh({
        dirty: false,
        fallbackIntervalMs: 60_000,
        isVisible: true,
        lastSyncedAt: 10_000,
        now: 20_000,
      }),
    ).toBe(false);

    expect(
      shouldRunAdminPrintingFallbackRefresh({
        dirty: false,
        fallbackIntervalMs: 60_000,
        isVisible: true,
        lastSyncedAt: 10_000,
        now: 70_001,
      }),
    ).toBe(true);
  });

  it('builds print summary defaults, button labels, and encoded deep links', () => {
    expect(createEmptyAdminPrintSummary('work-order-1')).toEqual({
      hasActiveJob: false,
      hasFailedJob: false,
      hasPendingJob: false,
      latestJob: null,
      reprintAllowed: true,
      workOrderId: 'work-order-1',
    });

    expect(getAdminPrintActionLabel(null)).toBe('建立列印任務');
    expect(
      getAdminPrintActionLabel({
        hasActiveJob: false,
        hasFailedJob: true,
        hasPendingJob: false,
        latestJob: {
          attemptCount: 3,
          createdAt: '2026-05-27T01:00:00.000Z',
          id: 'job-1',
          lastError: 'Printer offline',
          maxAttempts: 3,
          printedAt: null,
          status: 'failed',
          updatedAt: '2026-05-27T01:01:00.000Z',
        },
        reprintAllowed: true,
        workOrderId: 'work-order-1',
      }),
    ).toBe('建立補印');

    expect(getAdminPrintingCenterPath('BR 2026/#1')).toBe(
      '/admin/printing?paperOrderNo=BR%202026%2F%231',
    );
    expect(getAdminPrintingCenterPath(null)).toBe('/admin/printing');
  });
});
