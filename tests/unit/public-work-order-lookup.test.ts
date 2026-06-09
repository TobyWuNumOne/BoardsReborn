import type { H3Event } from 'h3';
import { describe, expect, it } from 'vitest';
import {
  TooManyRequestsError,
  ValidationError,
} from '../../server/utils/api-errors';
import {
  applyInMemoryRateLimit,
  getRateLimitClientIp,
} from '../../server/utils/public-rate-limit';
import {
  buildPublicWorkOrderLookupPayload,
  formatPublicCurrency,
} from '../../app/utils/public-work-order-lookup';
import { parsePublicWorkOrderLookupBody } from '../../server/utils/work-order-validation';
import { buildPublicWorkOrderProgress, lookupPublicWorkOrder } from '../../server/utils/work-orders';

const createMockEvent = (requestHeaders: Record<string, string | undefined> = {}, remoteAddress = '') =>
  ({
    node: {
      req: {
        headers: Object.fromEntries(
          Object.entries(requestHeaders).map(([key, value]) => [key.toLowerCase(), value]),
        ),
        socket: {
          remoteAddress,
        },
      },
    },
  }) as unknown as H3Event;

const createPublicLookupClient = ({
  repairMarks,
  quoteItem,
  workOrder,
}: {
  repairMarks: { data: unknown; error: unknown };
  quoteItem: { data: unknown; error: unknown };
  workOrder: { data: unknown; error: unknown };
}) => {
  const workOrderQuery = {
    eq() {
      return workOrderQuery;
    },
    maybeSingle() {
      return Promise.resolve(workOrder);
    },
    select() {
      return workOrderQuery;
    },
  };
  const quoteQuery = {
    eq() {
      return quoteQuery;
    },
    maybeSingle() {
      return Promise.resolve(quoteItem);
    },
    select() {
      return quoteQuery;
    },
  };
  const repairMarksQuery = {
    eq() {
      return repairMarksQuery;
    },
    order() {
      return Promise.resolve(repairMarks);
    },
    select() {
      return repairMarksQuery;
    },
  };

  return {
    client: {
      from(table: string) {
        if (table === 'work_orders') {
          return workOrderQuery;
        }

        if (table === 'quote_items') {
          return quoteQuery;
        }

        if (table === 'work_order_repair_marks') {
          return repairMarksQuery;
        }

        throw new Error(`Unexpected table ${table}`);
      },
    },
  };
};

describe('public work-order lookup', () => {
  it('validates and normalizes the public lookup request body', () => {
    expect(
      parsePublicWorkOrderLookupBody({
        paperOrderNo: '  BR-2026-0001  ',
        phone: '+886 912 345 678',
      }),
    ).toEqual({
      normalizedPhone: '0912345678',
      paperOrderNo: 'BR-2026-0001',
    });

    expect(() =>
      parsePublicWorkOrderLookupBody({
        paperOrderNo: 'AB',
        phone: '02-1234-5678',
      }),
    ).toThrow(ValidationError);
  });

  it('builds public lookup payloads without leaking raw phone formatting', () => {
    expect(
      buildPublicWorkOrderLookupPayload({
        paperOrderNo: '  BR-2026-0001  ',
        phone: '0912-345-678',
      }),
    ).toEqual({
      data: {
        paperOrderNo: 'BR-2026-0001',
        phone: '0912345678',
      },
    });

    expect(
      buildPublicWorkOrderLookupPayload({
        paperOrderNo: '',
        phone: '123',
      }),
    ).toEqual({
      fieldErrors: {
        paperOrderNo: ['請輸入紙本工單號。'],
        phone: ['請輸入完整台灣手機號碼。'],
      },
    });
  });

  it('builds snowboard and cancelled progress without letting the client guess steps', () => {
    expect(buildPublicWorkOrderProgress('SNOWBOARD', 'REPAIRING')).toEqual({
      currentStepKey: 'REPAIRING',
      kind: 'timeline',
      steps: [
        { key: 'RECEIVED', label: '已收件', state: 'done' },
        { key: 'REPAIRING', label: '維修中', state: 'current' },
        { key: 'READY_FOR_PICKUP', label: '待取件', state: 'upcoming' },
        { key: 'DELIVERED', label: '已交件', state: 'upcoming' },
      ],
    });

    expect(buildPublicWorkOrderProgress('SURFBOARD', 'CANCELLED')).toEqual({
      kind: 'cancelled',
      message: '此工單已取消',
    });
  });

  it('returns only public fields and compares the normalized full phone on the server', async () => {
    const { client } = createPublicLookupClient({
      repairMarks: {
        data: [
          {
            board_side: 'front',
            created_at: '2026-04-29T09:00:00.000Z',
            height_ratio: 0.12,
            id: 'mark-1',
            sort_order: 0,
            template_key: 'SURFBOARD:front:v1',
            updated_at: '2026-04-29T09:00:00.000Z',
            width_ratio: 0.16,
            work_order_id: 'work-order-1',
            x_ratio: 0.45,
            y_ratio: 0.32,
          },
        ],
        error: null,
      },
      quoteItem: {
        data: { amount: 2500 },
        error: null,
      },
      workOrder: {
        data: {
          board_type: 'SURFBOARD',
          current_status: 'REPAIRING',
          customers: { phone: '0912-345-678' },
          estimated_completion_date: '2026-05-10',
          id: 'work-order-1',
          paper_order_no: 'BR-2026-0001',
          public_note: '目前已進入維修流程',
          repair_count: 1,
          repair_count_source: 'auto',
          updated_at: '2026-04-30T10:00:00.000Z',
        },
        error: null,
      },
    });

    await expect(
      lookupPublicWorkOrder(client as never, {
        normalizedPhone: '0912345678',
        paperOrderNo: 'BR-2026-0001',
      }),
    ).resolves.toEqual({
      data: {
        boardType: 'SURFBOARD',
        currentStatus: 'REPAIRING',
        estimatedCompletionDate: '2026-05-10',
        initialQuoteAmount: 2500,
        lastUpdatedAt: '2026-04-30T10:00:00.000Z',
        paperOrderNo: 'BR-2026-0001',
        progress: {
          currentStepKey: 'REPAIRING',
          kind: 'timeline',
          steps: [
            { key: 'RECEIVED', label: '已收件', state: 'done' },
            { key: 'DRYING', label: '除濕中', state: 'done' },
            { key: 'REPAIRING', label: '維修中', state: 'current' },
            { key: 'READY_FOR_PICKUP', label: '待取件', state: 'upcoming' },
            { key: 'DELIVERED', label: '已交件', state: 'upcoming' },
          ],
        },
        publicNote: '目前已進入維修流程',
        repairCount: 1,
        repairCountSource: 'auto',
        repairMarkCount: 1,
        repairMarks: [
          {
            boardSide: 'front',
            heightRatio: 0.12,
            id: 'mark-1',
            sortOrder: 0,
            templateKey: 'SURFBOARD:front:v1',
            widthRatio: 0.16,
            xRatio: 0.45,
            yRatio: 0.32,
          },
        ],
        statusLabel: '維修中',
      },
    });
  });

  it('returns the same not found response when the phone does not match', async () => {
    const { client } = createPublicLookupClient({
      repairMarks: {
        data: [],
        error: null,
      },
      quoteItem: {
        data: null,
        error: null,
      },
      workOrder: {
        data: {
          board_type: 'SURFBOARD',
          current_status: 'REPAIRING',
          customers: { phone: '0912-345-678' },
          estimated_completion_date: '2026-05-10',
          id: 'work-order-1',
          paper_order_no: 'BR-2026-0001',
          public_note: null,
          repair_count: null,
          repair_count_source: 'auto',
          updated_at: '2026-04-30T10:00:00.000Z',
        },
        error: null,
      },
    });

    await expect(
      lookupPublicWorkOrder(client as never, {
        normalizedPhone: '0999999999',
        paperOrderNo: 'BR-2026-0001',
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        message: '查無符合的工單，請確認工單號與手機號碼。',
      }),
    );
  });

  it('uses x-forwarded-for first and falls back to remoteAddress for rate limiting', () => {
    expect(
      getRateLimitClientIp(
        createMockEvent({ 'x-forwarded-for': '203.0.113.10, 10.0.0.1' }, '127.0.0.1'),
      ),
    ).toBe('203.0.113.10');
    expect(getRateLimitClientIp(createMockEvent({}, '127.0.0.1'))).toBe('127.0.0.1');
  });

  it('uses an in-memory limiter for MVP and throws after the limit is exceeded', () => {
    const store = new Map();

    applyInMemoryRateLimit({
      key: 'public-lookup:127.0.0.1',
      limit: 2,
      nowMs: 1000,
      store,
      windowMs: 60_000,
    });
    applyInMemoryRateLimit({
      key: 'public-lookup:127.0.0.1',
      limit: 2,
      nowMs: 1001,
      store,
      windowMs: 60_000,
    });

    expect(() =>
      applyInMemoryRateLimit({
        key: 'public-lookup:127.0.0.1',
        limit: 2,
        nowMs: 1002,
        store,
        windowMs: 60_000,
      }),
    ).toThrow(TooManyRequestsError);
  });

  it('formats nullable public quote amounts safely', () => {
    expect(formatPublicCurrency(null)).toBe('未提供');
    expect(formatPublicCurrency(2500)).toBe('NT$ 2,500');
  });
});
