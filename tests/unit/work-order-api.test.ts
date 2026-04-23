import { describe, expect, it } from 'vitest';
import { InternalServerError, NotFoundError, ValidationError } from '../../server/utils/api-errors';
import { normalizeTaiwanMobilePhone } from '../../server/utils/phone';
import { throwMappedSupabaseError } from '../../server/utils/supabase-errors';
import {
  bulkAdminWorkOrderStatus,
  buildWorkOrderPatchUpdates,
  getStaleReceivedDays,
  mapStatusTransitionResult,
  mapWorkOrderListRow,
  mapWorkOrderResolveRow,
  resolveAdminWorkOrderByPaperOrderNo,
} from '../../server/utils/work-orders';
import {
  parseBulkStatusBody,
  WORK_ORDER_LIST_SORT_FIELDS,
  parseCreateWorkOrderBody,
  parseCustomerLookupQuery,
  parsePaperOrderResolveQuery,
  parsePatchWorkOrderBody,
  parseStatusTransitionBody,
  parseUuid,
  parseWorkOrderListQuery,
} from '../../server/utils/work-order-validation';

const createResolveWorkOrderClient = (result: { data: unknown; error: unknown }) => {
  const calls = {
    eq: { column: '', value: '' },
    table: '',
  };

  const query = {
    eq(column: string, value: string) {
      calls.eq = { column, value };
      return query;
    },
    maybeSingle() {
      return Promise.resolve(result);
    },
    select() {
      return query;
    },
  };

  return {
    calls,
    client: {
      from(table: string) {
        calls.table = table;
        return query;
      },
    },
  };
};

const createBulkStatusClient = ({
  lookupResult,
  rpcResolver,
}: {
  lookupResult: { data: unknown; error: unknown };
  rpcResolver: (args: Record<string, unknown>) => { data: unknown; error: unknown };
}) => {
  const calls = {
    in: {
      column: '',
      values: [] as string[],
    },
    rpcArgs: [] as Array<Record<string, unknown>>,
    table: '',
  };

  const query = {
    in(column: string, values: string[]) {
      calls.in = { column, values };
      return Promise.resolve(lookupResult);
    },
    select() {
      return query;
    },
  };

  return {
    calls,
    client: {
      from(table: string) {
        calls.table = table;
        return query;
      },
      rpc(_name: string, args: Record<string, unknown>) {
        calls.rpcArgs.push(args);
        return Promise.resolve(rpcResolver(args));
      },
    },
  };
};

const expectValidationField = (action: () => unknown, field: string) => {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).fieldErrors).toHaveProperty(field);
    return;
  }

  throw new Error('Expected ValidationError');
};

describe('work order API validation', () => {
  it('normalizes Taiwan mobile phone values consistently', () => {
    expect(normalizeTaiwanMobilePhone('0912-345-678')).toBe('0912345678');
    expect(normalizeTaiwanMobilePhone('+886 912 345 678')).toBe('0912345678');
    expect(normalizeTaiwanMobilePhone('02-1234-5678')).toBeNull();
  });

  it('validates customer lookup phone query', () => {
    expect(parseCustomerLookupQuery({ phone: '0912 345 678' })).toEqual({
      normalizedPhone: '0912345678',
    });
    expectValidationField(() => parseCustomerLookupQuery({ phone: '02-1234-5678' }), 'phone');
  });

  it('validates paper order resolve query without changing paper number format rules', () => {
    expect(parsePaperOrderResolveQuery({ paperOrderNo: '  BR-2026-0001  ' })).toEqual({
      paperOrderNo: 'BR-2026-0001',
    });
    expectValidationField(() => parsePaperOrderResolveQuery({ paperOrderNo: '' }), 'paperOrderNo');
    expectValidationField(
      () => parsePaperOrderResolveQuery({ paperOrderNo: 'AB' }),
      'paperOrderNo',
    );
    expectValidationField(
      () => parsePaperOrderResolveQuery({ paperOrderNo: 'A'.repeat(51) }),
      'paperOrderNo',
    );
  });

  it('requires explicit customer create or reuse mode for work order creation', () => {
    const createInput = parseCreateWorkOrderBody({
      board: { boardType: 'SURFBOARD', sizeLabel: "6'2" },
      customer: { name: '王小明', phone: '0912-345-678' },
      customerMode: 'create',
      quoteItems: [],
      workOrder: {
        intakeDate: '2026-04-20',
        paperOrderNo: 'BR-2026-0001',
      },
    });

    expect(createInput.customer?.phone).toBe('0912345678');
    expect(createInput.workOrder.paymentReceived).toBe(false);

    const reuseInput = parseCreateWorkOrderBody({
      board: { boardType: 'SUP' },
      customerId: '4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2',
      customerMode: 'reuse',
      workOrder: {
        intakeDate: '2026-04-20',
        paperOrderNo: 'BR-2026-0002',
      },
    });

    expect(reuseInput.customerId).toBe('4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2');
    expectValidationField(
      () =>
        parseCreateWorkOrderBody({
          board: { boardType: 'SUP' },
          customer: { name: '王小明', phone: '0912345678' },
          customerMode: 'reuse',
          workOrder: {
            intakeDate: '2026-04-20',
            paperOrderNo: 'BR-2026-0003',
          },
        }),
      'customer',
    );
  });

  it('rejects duplicate INITIAL quote items before hitting the database', () => {
    expectValidationField(
      () =>
        parseCreateWorkOrderBody({
          board: { boardType: 'SURFBOARD' },
          customer: { name: '王小明', phone: '0912345678' },
          customerMode: 'create',
          quoteItems: [
            { amount: 500, description: '初始報價', itemType: 'INITIAL' },
            { amount: 200, description: '另一筆初始報價', itemType: 'INITIAL' },
          ],
          workOrder: {
            intakeDate: '2026-04-20',
            paperOrderNo: 'BR-2026-0004',
          },
        }),
      'quoteItems',
    );
  });

  it('keeps list pagination, stale received, and sort rules explicit', () => {
    const query = parseWorkOrderListQuery(
      {
        page: '2',
        pageSize: '10',
        sort: 'quote_total_amount:asc',
        staleReceived: 'true',
      },
      new Date('2026-04-22T00:00:00.000Z'),
    );

    expect(WORK_ORDER_LIST_SORT_FIELDS).toContain('quote_total_amount');
    expect(getStaleReceivedDays()).toBe(7);
    expect(query).toMatchObject({
      filters: { staleReceived: true },
      page: 2,
      pageSize: 10,
      sort: { direction: 'asc', field: 'quote_total_amount' },
      staleReceivedBefore: '2026-04-15T00:00:00.000Z',
    });
    expectValidationField(() => parseWorkOrderListQuery({ sort: 'customer_name:asc' }), 'sort');
  });

  it('validates bulk status bodies, trims note, and dedupes paper order numbers', () => {
    expect(
      parseBulkStatusBody({
        note: '  今日統一開工  ',
        paperOrderNos: [' BR-2026-0001 ', 'BR-2026-0002', 'BR-2026-0001'],
        status: 'REPAIRING',
      }),
    ).toEqual({
      note: '今日統一開工',
      paperOrderNos: ['BR-2026-0001', 'BR-2026-0002'],
      requestedCount: 3,
      status: 'REPAIRING',
    });
    expectValidationField(
      () => parseBulkStatusBody({ paperOrderNos: [], status: 'REPAIRING' }),
      'paperOrderNos',
    );
    expectValidationField(
      () =>
        parseBulkStatusBody({
          internalNote: 'x',
          paperOrderNos: ['BR-2026-0001'],
          status: 'REPAIRING',
        }),
      'internalNote',
    );
  });

  it('restricts PATCH to the work-order update whitelist', () => {
    expect(parsePatchWorkOrderBody({ paymentReceived: true })).toEqual({
      paymentReceived: true,
    });
    expectValidationField(
      () => parsePatchWorkOrderBody({ currentStatus: 'REPAIRING' }),
      'currentStatus',
    );
  });

  it('validates status transition bodies and rejects unsupported reason', () => {
    expect(
      parseStatusTransitionBody({
        internalNote: '  只給店內看  ',
        note: '  已完成，等待取件  ',
        status: 'READY_FOR_PICKUP',
      }),
    ).toEqual({
      hasInternalNote: true,
      internalNote: '只給店內看',
      note: '已完成，等待取件',
      status: 'READY_FOR_PICKUP',
    });
    expect(parseStatusTransitionBody({ note: '   ', status: 'REPAIRING' })).toEqual({
      hasInternalNote: false,
      note: null,
      status: 'REPAIRING',
    });
    expectValidationField(
      () => parseStatusTransitionBody({ reason: '客人取消', status: 'CANCELLED' }),
      'reason',
    );
    expectValidationField(() => parseStatusTransitionBody({ status: 'UNKNOWN' }), 'status');
    expectValidationField(() => parseUuid('not-a-uuid', 'id'), 'id');
  });

  it('maps SNOWBOARD to DRYING database errors to validation field errors', () => {
    try {
      throwMappedSupabaseError({
        code: '23514',
        message: 'SNOWBOARD work orders cannot enter DRYING',
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).code).toBe('VALIDATION_ERROR');
      expect((error as ValidationError).fieldErrors).toHaveProperty('status');
      return;
    }

    throw new Error('Expected ValidationError');
  });

  it('maintains payment timestamp transitions for PATCH', () => {
    const now = new Date('2026-04-22T10:00:00.000Z');

    expect(
      buildWorkOrderPatchUpdates(
        { paymentReceived: true },
        { payment_received: false, payment_received_at: null },
        now,
      ),
    ).toEqual({
      payment_received: true,
      payment_received_at: '2026-04-22T10:00:00.000Z',
    });
    expect(
      buildWorkOrderPatchUpdates(
        { paymentReceived: false },
        { payment_received: true, payment_received_at: '2026-04-20T08:00:00.000Z' },
        now,
      ),
    ).toEqual({
      payment_received: false,
      payment_received_at: null,
    });
  });

  it('maps list rows to the camelCase API contract', () => {
    expect(
      mapWorkOrderListRow({
        board_size_label: "6'2",
        board_type: 'SURFBOARD',
        created_at: '2026-04-20T08:00:00.000Z',
        current_status: 'REPAIRING',
        customer_id: 'customer-id',
        customer_name: '王小明',
        customer_normalized_phone: '0912345678',
        customer_phone: '0912345678',
        estimated_completion_date: '2026-04-26',
        id: 'work-order-id',
        intake_date: '2026-04-20',
        is_overdue_estimated_completion: false,
        is_pickup_overdue: false,
        latest_received_at: '2026-04-20T08:00:00.000Z',
        notified_at: null,
        paper_order_no: 'BR-2026-0001',
        payment_received: true,
        payment_received_at: '2026-04-20T08:00:00.000Z',
        picked_up_at: null,
        quote_total_amount: 700,
        ready_for_pickup_at: null,
        storage_fee_warning_after_days: 14,
        updated_at: '2026-04-20T08:30:00.000Z',
      }),
    ).toMatchObject({
      board: { boardType: 'SURFBOARD', sizeLabel: "6'2" },
      customer: { id: 'customer-id', name: '王小明', phone: '0912345678' },
      paperOrderNo: 'BR-2026-0001',
      quoteTotalAmount: 700,
    });
  });

  it('maps resolve rows to the camelCase API contract', () => {
    expect(
      mapWorkOrderResolveRow({
        board_size_label: "6'2",
        board_type: 'SURFBOARD',
        current_status: 'REPAIRING',
        customers: {
          id: 'customer-id',
          name: '王小明',
        },
        id: 'work-order-id',
        paper_order_no: 'BR-2026-0001',
        updated_at: '2026-04-20T08:30:00.000Z',
      }),
    ).toEqual({
      board: {
        boardType: 'SURFBOARD',
        sizeLabel: "6'2",
      },
      currentStatus: 'REPAIRING',
      customer: {
        id: 'customer-id',
        name: '王小明',
      },
      id: 'work-order-id',
      lastUpdatedAt: '2026-04-20T08:30:00.000Z',
      paperOrderNo: 'BR-2026-0001',
    });
  });

  it('resolves work orders by exact paper order number and returns 404 when missing', async () => {
    const { calls, client } = createResolveWorkOrderClient({
      data: null,
      error: null,
    });

    await expect(
      resolveAdminWorkOrderByPaperOrderNo(
        client as Parameters<typeof resolveAdminWorkOrderByPaperOrderNo>[0],
        'BR-2026-0001',
      ),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(calls.table).toBe('work_orders');
    expect(calls.eq).toEqual({
      column: 'paper_order_no',
      value: 'BR-2026-0001',
    });
  });

  it('maps status transition RPC results to the camelCase API contract', () => {
    expect(
      mapStatusTransitionResult({
        statusHistory: {
          changedAt: '2026-04-22T10:01:00.000Z',
          id: 'status-history-id',
          note: '已完成',
          status: 'READY_FOR_PICKUP',
        },
        workOrder: {
          cancelledAt: null,
          currentStatus: 'READY_FOR_PICKUP',
          deliveredAt: null,
          id: 'work-order-id',
          paperOrderNo: 'BR-2026-0001',
          readyForPickupAt: '2026-04-22T10:01:00.000Z',
          updatedAt: '2026-04-22T10:01:00.000Z',
        },
      }),
    ).toEqual({
      statusHistory: {
        changedAt: '2026-04-22T10:01:00.000Z',
        id: 'status-history-id',
        note: '已完成',
        status: 'READY_FOR_PICKUP',
      },
      workOrder: {
        cancelledAt: null,
        currentStatus: 'READY_FOR_PICKUP',
        deliveredAt: null,
        id: 'work-order-id',
        paperOrderNo: 'BR-2026-0001',
        readyForPickupAt: '2026-04-22T10:01:00.000Z',
        updatedAt: '2026-04-22T10:01:00.000Z',
      },
    });
  });

  it('bulk status keeps first-seen order and returns updated/skipped summaries', async () => {
    const { calls, client } = createBulkStatusClient({
      lookupResult: {
        data: [
          { id: 'work-order-2', paper_order_no: 'BR-2026-0002' },
          { id: 'work-order-1', paper_order_no: 'BR-2026-0001' },
        ],
        error: null,
      },
      rpcResolver: (args) => {
        if (args.p_work_order_id === 'work-order-1') {
          return {
            data: {
              statusHistory: {
                changedAt: '2026-04-22T10:01:00.000Z',
                id: 'status-history-1',
                note: '今日統一開工',
                status: 'DRYING',
              },
              workOrder: {
                cancelledAt: null,
                currentStatus: 'DRYING',
                deliveredAt: null,
                id: 'work-order-1',
                paperOrderNo: 'BR-2026-0001',
                readyForPickupAt: null,
                updatedAt: '2026-04-22T10:01:00.000Z',
              },
            },
            error: null,
          };
        }

        return {
          data: null,
          error: {
            code: '23514',
            message: 'SNOWBOARD work orders cannot enter DRYING',
          },
        };
      },
    });

    const result = await bulkAdminWorkOrderStatus(
      client as Parameters<typeof bulkAdminWorkOrderStatus>[0],
      {
        note: '今日統一開工',
        paperOrderNos: ['BR-2026-0001', 'BR-2026-0002', 'BR-2026-0003'],
        requestedCount: 4,
        status: 'DRYING',
      },
      'admin-user-id',
    );

    expect(calls.table).toBe('work_orders');
    expect(calls.in).toEqual({
      column: 'paper_order_no',
      values: ['BR-2026-0001', 'BR-2026-0002', 'BR-2026-0003'],
    });
    expect(result).toEqual({
      data: {
        dedupedCount: 3,
        requestedCount: 4,
        skipped: [
          {
            paperOrderNo: 'BR-2026-0002',
            reason: 'INVALID_STATUS_TRANSITION',
          },
          {
            paperOrderNo: 'BR-2026-0003',
            reason: 'NOT_FOUND',
          },
        ],
        skippedCount: 2,
        updated: [
          {
            currentStatus: 'DRYING',
            paperOrderNo: 'BR-2026-0001',
            statusHistoryId: 'status-history-1',
            workOrderId: 'work-order-1',
          },
        ],
        updatedCount: 1,
      },
    });
  });

  it('bulk status stops immediately on unknown system errors', async () => {
    const { calls, client } = createBulkStatusClient({
      lookupResult: {
        data: [
          { id: 'work-order-1', paper_order_no: 'BR-2026-0001' },
          { id: 'work-order-2', paper_order_no: 'BR-2026-0002' },
          { id: 'work-order-3', paper_order_no: 'BR-2026-0003' },
        ],
        error: null,
      },
      rpcResolver: (args) => {
        if (args.p_work_order_id === 'work-order-1') {
          return {
            data: {
              statusHistory: {
                changedAt: '2026-04-22T10:01:00.000Z',
                id: 'status-history-1',
                note: null,
                status: 'REPAIRING',
              },
              workOrder: {
                cancelledAt: null,
                currentStatus: 'REPAIRING',
                deliveredAt: null,
                id: 'work-order-1',
                paperOrderNo: 'BR-2026-0001',
                readyForPickupAt: null,
                updatedAt: '2026-04-22T10:01:00.000Z',
              },
            },
            error: null,
          };
        }

        if (args.p_work_order_id === 'work-order-2') {
          return {
            data: null,
            error: {
              code: 'XX000',
              message: 'database exploded',
            },
          };
        }

        return {
          data: {
            statusHistory: {
              changedAt: '2026-04-22T10:03:00.000Z',
              id: 'status-history-3',
              note: null,
              status: 'REPAIRING',
            },
            workOrder: {
              cancelledAt: null,
              currentStatus: 'REPAIRING',
              deliveredAt: null,
              id: 'work-order-3',
              paperOrderNo: 'BR-2026-0003',
              readyForPickupAt: null,
              updatedAt: '2026-04-22T10:03:00.000Z',
            },
          },
          error: null,
        };
      },
    });

    await expect(
      bulkAdminWorkOrderStatus(
        client as Parameters<typeof bulkAdminWorkOrderStatus>[0],
        {
          paperOrderNos: ['BR-2026-0001', 'BR-2026-0002', 'BR-2026-0003'],
          requestedCount: 3,
          status: 'REPAIRING',
        },
        'admin-user-id',
      ),
    ).rejects.toBeInstanceOf(InternalServerError);

    expect(calls.rpcArgs).toHaveLength(2);
    expect(calls.rpcArgs[0]?.p_work_order_id).toBe('work-order-1');
    expect(calls.rpcArgs[1]?.p_work_order_id).toBe('work-order-2');
  });
});
