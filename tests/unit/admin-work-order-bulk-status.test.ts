import { describe, expect, it } from 'vitest';
import type { AdminWorkOrderResolveItem } from '../../app/utils/admin-work-orders';
import {
  ADMIN_BULK_STATUS_RESOLVE_CONCURRENCY,
  buildAdminBulkStatusSubmitPayload,
  getAdminBulkStatusQuickTarget,
  getAdminBulkStatusSelectedPaperOrderNos,
  groupAdminBulkStatusPreviewItems,
  hasAdminBulkStatusSelectedSnowboards,
  parseAdminBulkStatusPaperOrderNos,
  resolveAdminBulkStatusPreview,
} from '../../app/utils/admin-work-order-bulk-status';

const createResolvedWorkOrder = (
  paperOrderNo: string,
  currentStatus: AdminWorkOrderResolveItem['currentStatus'] = 'RECEIVED',
  boardType: AdminWorkOrderResolveItem['board']['boardType'] = 'SURFBOARD',
): AdminWorkOrderResolveItem => ({
  board: {
    color: 'BLUE',
    boardLengthClass: boardType === 'SURFBOARD' ? 'SHORTBOARD' : null,
    boardType,
    sizeLabel: "6'2",
  },
  currentStatus,
  customer: {
    id: `customer-${paperOrderNo}`,
    name: `客戶 ${paperOrderNo}`,
    phone: '0912345678',
  },
  estimatedCompletionDate: '2026-05-10',
  flags: {
    overdueEstimatedCompletion: false,
    pickupOverdue: false,
    staleReceived: false,
  },
  id: `work-order-${paperOrderNo}`,
  lastUpdatedAt: '2026-04-30T08:00:00.000Z',
  paperOrderNo,
});

describe('admin bulk status helpers', () => {
  it('parses textarea input with trim, dedupe, and first-seen order preserved', () => {
    expect(
      parseAdminBulkStatusPaperOrderNos(
        ' BR-2026-0001,\nBR-2026-0002  BR-2026-0001\n\nBR-2026-0003 ',
      ),
    ).toEqual(['BR-2026-0001', 'BR-2026-0002', 'BR-2026-0003']);
  });

  it('limits resolve preview fan-out concurrency to 6 requests', async () => {
    const paperOrderNos = Array.from({ length: 12 }, (_, index) => `BR-2026-${index + 1}`);
    let activeRequests = 0;
    let maxConcurrentRequests = 0;

    await resolveAdminBulkStatusPreview(paperOrderNos, async (paperOrderNo) => {
      activeRequests += 1;
      maxConcurrentRequests = Math.max(maxConcurrentRequests, activeRequests);

      await new Promise((resolve) => setTimeout(resolve, 5));

      activeRequests -= 1;
      return createResolvedWorkOrder(paperOrderNo);
    });

    expect(maxConcurrentRequests).toBeLessThanOrEqual(ADMIN_BULK_STATUS_RESOLVE_CONCURRENCY);
  });

  it('treats non-auth resolve failures as notFound without aborting the batch', async () => {
    const result = await resolveAdminBulkStatusPreview(
      ['BR-2026-0001', 'BR-2026-0002', 'BR-2026-0003'],
      async (paperOrderNo) => {
        if (paperOrderNo === 'BR-2026-0002') {
          throw {
            status: 500,
          };
        }

        return createResolvedWorkOrder(paperOrderNo);
      },
    );

    expect(result).toEqual({
      found: [createResolvedWorkOrder('BR-2026-0001'), createResolvedWorkOrder('BR-2026-0003')],
      notFound: ['BR-2026-0002'],
    });
  });

  it('rethrows auth failures so the page can hand control back to session refresh flow', async () => {
    await expect(
      resolveAdminBulkStatusPreview(['BR-2026-0001'], async () => {
        throw {
          status: 401,
        };
      }),
    ).rejects.toMatchObject({
      status: 401,
    });
  });

  it('groups found items by fixed status order and reports selected counts', () => {
    const items = [
      createResolvedWorkOrder('BR-2026-0004', 'READY_FOR_PICKUP'),
      createResolvedWorkOrder('BR-2026-0001', 'RECEIVED'),
      createResolvedWorkOrder('BR-2026-0003', 'REPAIRING'),
      createResolvedWorkOrder('BR-2026-0002', 'DRYING'),
    ];

    expect(groupAdminBulkStatusPreviewItems(items, ['BR-2026-0001', 'BR-2026-0003'])).toEqual([
      {
        items: [createResolvedWorkOrder('BR-2026-0001', 'RECEIVED')],
        key: 'RECEIVED',
        label: '已收件',
        nextStatus: 'REPAIRING',
        selectedCount: 1,
        totalCount: 1,
      },
      {
        items: [createResolvedWorkOrder('BR-2026-0002', 'DRYING')],
        key: 'DRYING',
        label: '除濕中',
        nextStatus: 'REPAIRING',
        selectedCount: 0,
        totalCount: 1,
      },
      {
        items: [createResolvedWorkOrder('BR-2026-0003', 'REPAIRING')],
        key: 'REPAIRING',
        label: '維修中',
        nextStatus: 'READY_FOR_PICKUP',
        selectedCount: 1,
        totalCount: 1,
      },
      {
        items: [createResolvedWorkOrder('BR-2026-0004', 'READY_FOR_PICKUP')],
        key: 'READY_FOR_PICKUP',
        label: '已完工待取件',
        nextStatus: 'DELIVERED',
        selectedCount: 0,
        totalCount: 1,
      },
    ]);
  });

  it('builds bulk submit payloads from selected found items in original input order', () => {
    expect(
      buildAdminBulkStatusSubmitPayload(
        ['BR-2026-0001', 'BR-2026-0003'],
        'REPAIRING',
        '  今日統一開工  ',
      ),
    ).toEqual({
      fieldErrors: {},
      payload: {
        note: '今日統一開工',
        paperOrderNos: ['BR-2026-0001', 'BR-2026-0003'],
        status: 'REPAIRING',
      },
    });

    expect(buildAdminBulkStatusSubmitPayload([], '', '   ')).toEqual({
      fieldErrors: {
        paperOrderNos: ['請至少選取一筆工單。'],
        status: ['請選擇目標狀態。'],
      },
      payload: null,
    });
  });

  it('detects snowboard selections for DRYING warnings and preserves original selection order', () => {
    const items = [
      createResolvedWorkOrder('BR-2026-0001', 'RECEIVED', 'SURFBOARD'),
      createResolvedWorkOrder('BR-2026-0002', 'RECEIVED', 'SNOWBOARD'),
      createResolvedWorkOrder('BR-2026-0003', 'REPAIRING', 'SURFBOARD'),
    ];

    expect(getAdminBulkStatusSelectedPaperOrderNos(items, ['BR-2026-0003', 'BR-2026-0001'])).toEqual([
      'BR-2026-0001',
      'BR-2026-0003',
    ]);
    expect(hasAdminBulkStatusSelectedSnowboards(items, ['BR-2026-0002'])).toBe(true);
    expect(hasAdminBulkStatusSelectedSnowboards(items, ['BR-2026-0001', 'BR-2026-0003'])).toBe(
      false,
    );
  });

  it('exposes fixed next-stage shortcuts for each grouped status', () => {
    expect(getAdminBulkStatusQuickTarget('RECEIVED')).toBe('REPAIRING');
    expect(getAdminBulkStatusQuickTarget('DRYING')).toBe('REPAIRING');
    expect(getAdminBulkStatusQuickTarget('REPAIRING')).toBe('READY_FOR_PICKUP');
    expect(getAdminBulkStatusQuickTarget('READY_FOR_PICKUP')).toBe('DELIVERED');
    expect(getAdminBulkStatusQuickTarget('DELIVERED')).toBeNull();
    expect(getAdminBulkStatusQuickTarget('CANCELLED')).toBeNull();
  });
});
