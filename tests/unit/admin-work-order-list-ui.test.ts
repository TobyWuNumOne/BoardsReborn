import { describe, expect, it } from 'vitest';
import {
  ADMIN_WORK_ORDER_LIST_SORT_OPTIONS,
  formatAdminDate,
  formatAdminDateTime,
  getActiveWorkOrderFlags,
  getAdjustedPageForPageInfo,
  getBoardTypeLabel,
  getVisiblePageNumbers,
  getWorkOrderStatusLabel,
  normalizeAdminWorkOrderListRouteQuery,
  serializeAdminWorkOrderListQuery,
} from '../../app/utils/admin-work-orders';
import { WORK_ORDER_LIST_SORT_FIELDS } from '../../server/utils/work-order-validation';

describe('admin work-order list UI helpers', () => {
  it('canonicalizes invalid route query values before the first fetch', () => {
    const normalized = normalizeAdminWorkOrderListRouteQuery({
      customerPhone: ' 0912 ',
      overdueEstimatedCompletion: 'maybe',
      page: '0',
      pageSize: '999',
      q: '  BR-2026-0001  ',
      sort: 'customer_name:asc',
      status: 'BROKEN',
    });

    expect(normalized.query).toMatchObject({
      customerPhone: '0912',
      overdueEstimatedCompletion: false,
      page: 1,
      pageSize: 20,
      pickupOverdue: false,
      q: 'BR-2026-0001',
      sort: 'created_at:desc',
      staleReceived: false,
      status: undefined,
    });
    expect(normalized.canonicalQuery).toEqual({
      customerPhone: '0912',
      q: 'BR-2026-0001',
    });
    expect(normalized.needsReplace).toBe(true);
  });

  it('parses boolean query values and round-trips canonical list state', () => {
    const normalized = normalizeAdminWorkOrderListRouteQuery({
      customerPhone: '0912345678',
      overdueEstimatedCompletion: 'true',
      page: '2',
      pageSize: '50',
      pickupOverdue: 'false',
      q: 'BR-2026-0001',
      sort: 'updated_at:desc',
      staleReceived: 'true',
      status: 'REPAIRING',
    });

    expect(normalized.query).toEqual({
      customerPhone: '0912345678',
      overdueEstimatedCompletion: true,
      page: 2,
      pageSize: 50,
      pickupOverdue: false,
      q: 'BR-2026-0001',
      sort: 'updated_at:desc',
      staleReceived: true,
      status: 'REPAIRING',
    });
    expect(serializeAdminWorkOrderListQuery(normalized.query)).toEqual({
      customerPhone: '0912345678',
      overdueEstimatedCompletion: 'true',
      page: '2',
      pageSize: '50',
      q: 'BR-2026-0001',
      sort: 'updated_at:desc',
      staleReceived: 'true',
      status: 'REPAIRING',
    });
  });

  it('keeps sort options aligned with the API whitelist and snake_case values', () => {
    const sortFields = new Set(
      ADMIN_WORK_ORDER_LIST_SORT_OPTIONS.map((option) => option.value.split(':')[0]),
    );

    expect(sortFields).toEqual(new Set(WORK_ORDER_LIST_SORT_FIELDS));
    expect(
      ADMIN_WORK_ORDER_LIST_SORT_OPTIONS.every((option) =>
        /^[a-z_]+:(asc|desc)$/.test(option.value),
      ),
    ).toBe(true);
  });

  it('formats labels, flags, and page helpers consistently', () => {
    expect(getBoardTypeLabel('SURFBOARD')).toBe('衝浪板');
    expect(getWorkOrderStatusLabel('READY_FOR_PICKUP')).toBe('已完工待取件');
    expect(
      getActiveWorkOrderFlags({
        overdueEstimatedCompletion: true,
        pickupOverdue: false,
        staleReceived: true,
      }),
    ).toEqual(['overdueEstimatedCompletion', 'staleReceived']);
    expect(
      getAdjustedPageForPageInfo(999, {
        hasNextPage: false,
        hasPreviousPage: true,
        page: 999,
        pageSize: 20,
        total: 52,
        totalPages: 3,
      }),
    ).toBe(3);
    expect(getVisiblePageNumbers(5, 10)).toEqual([3, 4, 5, 6, 7]);
    expect(formatAdminDate('2026-04-28')).toBe('2026/04/28');
    expect(formatAdminDateTime('2026-04-28T00:30:00.000Z')).toBe('2026/04/28 08:30');
  });
});
