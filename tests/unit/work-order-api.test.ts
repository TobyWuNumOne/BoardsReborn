import { describe, expect, it } from 'vitest';
import {
  ConflictError,
  InternalServerError,
  NotFoundError,
  ValidationError,
} from '../../server/utils/api-errors';
import { normalizeTaiwanMobilePhone } from '../../server/utils/phone';
import { throwMappedSupabaseError } from '../../server/utils/supabase-errors';
import {
  appendAdminWorkOrderScanQuickNote,
  bulkAdminWorkOrderStatus,
  buildWorkOrderPatchUpdates,
  deleteAdminWorkOrder,
  getAdminDashboardSummary,
  getAdminWorkOrderScanAvailableActions,
  getAdminWorkOrderScanAvailableStatusTransitions,
  getNextAdminPaperOrderNo,
  getStaleReceivedDays,
  getTaipeiDayRange,
  mapScanRecentHistory,
  mapStatusTransitionResult,
  mapWorkOrderListRow,
  mapWorkOrderResolveRow,
  resolveAdminWorkOrderByPaperOrderNo,
} from '../../server/utils/work-orders';
import {
  parseAdminWorkOrderScanLookupQuery,
  parseAdminWorkOrderScanQuickNoteBody,
  parseBulkStatusBody,
  WORK_ORDER_LIST_SORT_FIELDS,
  parseCreateWorkOrderBody,
  parseCustomerLookupQuery,
  parseNextPaperOrderNoQuery,
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

const createQuickNoteClient = ({
  selectResult,
  updateResult,
}: {
  selectResult: { data: unknown; error: unknown };
  updateResult: { data: unknown; error: unknown };
}) => {
  const calls = {
    selectCalls: [] as Array<{ filters: Array<{ column: string; value: string }>; table: string }>,
    updatePayloads: [] as unknown[],
  };

  const createSelectQuery = (
    table: string,
    filters: Array<{ column: string; value: string }> = [],
  ) => ({
    eq(column: string, value: string) {
      return createSelectQuery(table, [...filters, { column, value }]);
    },
    maybeSingle() {
      calls.selectCalls.push({ filters, table });
      return Promise.resolve(selectResult);
    },
    select() {
      return createSelectQuery(table, filters);
    },
  });

  const createUpdateQuery = (
    table: string,
    payload: unknown,
    filters: Array<{ column: string; value: string }> = [],
  ) => ({
    eq(column: string, value: string) {
      return createUpdateQuery(table, payload, [...filters, { column, value }]);
    },
    select() {
      return createUpdateQuery(table, payload, filters);
    },
    single() {
      calls.updatePayloads.push({ filters, payload, table });
      return Promise.resolve(updateResult);
    },
  });

  return {
    calls,
    client: {
      from(table: string) {
        return {
          select() {
            return createSelectQuery(table);
          },
          update(payload: unknown) {
            return createUpdateQuery(table, payload);
          },
        };
      },
    },
  };
};

const createDashboardSummaryClient = (counts: {
  createdToday: number;
  drying: number;
  metricRows?: Array<{
    board_length_class: 'LONGBOARD' | 'MID_LENGTH' | 'SHORTBOARD' | null;
    board_type: 'SNOWBOARD' | 'SUP' | 'SURFBOARD' | null;
    current_status: string | null;
    id: string | null;
    intake_date: string | null;
  }>;
  overdue: number;
  readyForPickup: number;
  received: number;
  repairing: number;
}) => {
  const resolveCount = (builder: Record<string, unknown>) => {
    const eqFilters = (builder.eq as Array<{ column: string; value: unknown }> | undefined) ?? [];
    const gteFilter = builder.gte as { column: string; value: unknown } | undefined;
    const ltFilter = builder.lt as { column: string; value: unknown } | undefined;

    if (
      eqFilters.some((filter) => filter.column === 'current_status' && filter.value === 'RECEIVED')
    ) {
      return counts.received;
    }

    if (
      eqFilters.some((filter) => filter.column === 'current_status' && filter.value === 'DRYING')
    ) {
      return counts.drying;
    }

    if (
      eqFilters.some((filter) => filter.column === 'current_status' && filter.value === 'REPAIRING')
    ) {
      return counts.repairing;
    }

    if (
      eqFilters.some(
        (filter) => filter.column === 'current_status' && filter.value === 'READY_FOR_PICKUP',
      )
    ) {
      return counts.readyForPickup;
    }

    if (
      eqFilters.some(
        (filter) => filter.column === 'is_overdue_estimated_completion' && filter.value === true,
      )
    ) {
      return counts.overdue;
    }

    if (gteFilter?.column === 'created_at' && ltFilter?.column === 'created_at') {
      return counts.createdToday;
    }

    return 0;
  };

  const createQuery = (table: string, builder: Record<string, unknown> = {}) => ({
    eq(column: string, value: unknown) {
      return createQuery(table, {
        ...builder,
        eq: [
          ...((builder.eq as Array<Record<string, unknown>> | undefined) ?? []),
          { column, value },
        ],
      });
    },
    gte(column: string, value: unknown) {
      return createQuery(table, {
        ...builder,
        gte: { column, value },
      });
    },
    in(column: string, values: unknown[]) {
      return createQuery(table, {
        ...builder,
        in: { column, values },
      });
    },
    lt(column: string, value: unknown) {
      return createQuery(table, {
        ...builder,
        lt: { column, value },
      });
    },
    order(column: string, options?: Record<string, unknown>) {
      return createQuery(table, {
        ...builder,
        order: { column, options },
      });
    },
    range(from: number, to: number) {
      const gteFilter = builder.gte as { column: string; value: string } | undefined;
      const ltFilter = builder.lt as { column: string; value: string } | undefined;
      const rows = (counts.metricRows ?? []).filter((row) => {
        if (!row.intake_date) {
          return false;
        }

        if (gteFilter?.column === 'intake_date' && row.intake_date < gteFilter.value) {
          return false;
        }

        if (ltFilter?.column === 'intake_date' && row.intake_date >= ltFilter.value) {
          return false;
        }

        return true;
      });

      return Promise.resolve({
        data: rows.slice(from, to + 1),
        error: null,
      });
    },
    select(columns: string, options?: Record<string, unknown>) {
      return createQuery(table, {
        ...builder,
        columns,
        options,
      });
    },
    then(
      onFulfilled?: ((value: { count: number; error: null }) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null,
    ) {
      const payload = {
        count: resolveCount({
          ...builder,
          table,
        }),
        error: null,
      };

      return Promise.resolve(payload).then(onFulfilled ?? undefined, onRejected ?? undefined);
    },
  });

  return {
    client: {
      from(table: string) {
        return createQuery(table);
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

  it('validates scan lookup query and rejects unsupported fields', () => {
    expect(parseAdminWorkOrderScanLookupQuery({ code: '  BR-2026-0001  ' })).toEqual({
      code: 'BR-2026-0001',
    });
    expectValidationField(() => parseAdminWorkOrderScanLookupQuery({}), 'code');
    expectValidationField(
      () => parseAdminWorkOrderScanLookupQuery({ code: 'BR-2026-0001', paperOrderNo: 'extra' }),
      'paperOrderNo',
    );
  });

  it('requires explicit customer create or reuse mode for work order creation', () => {
    const createInput = parseCreateWorkOrderBody({
      board: {
        boardLengthClass: 'SHORTBOARD',
        boardType: 'SURFBOARD',
        sizeLabel: "6'2",
      },
      customer: { name: '王小明', phone: '0912-345-678' },
      customerMode: 'create',
      repairMarks: [
        {
          boardSide: 'front',
          heightRatio: 0.1,
          sortOrder: 0,
          templateKey: 'SURFBOARD:front:v1',
          widthRatio: 0.1,
          xRatio: 0.4,
          yRatio: 0.3,
        },
      ],
      quoteItems: [],
      workOrder: {
        intakeDate: '2026-04-20',
      },
    });

    expect(createInput.customer?.phone).toBe('0912345678');
    expect(createInput.board.boardLengthClass).toBe('SHORTBOARD');
    expect(createInput.workOrder.paymentReceived).toBe(false);

    const reuseInput = parseCreateWorkOrderBody({
      board: { boardType: 'SUP' },
      customerId: '4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2',
      customerMode: 'reuse',
      workOrder: {
        intakeDate: '2026-04-20',
        repairCount: 2,
        repairCountSource: 'manual',
      },
    });

    expect(reuseInput.customerId).toBe('4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2');
    expect(reuseInput.workOrder.repairCount).toBe(2);
    expect(reuseInput.workOrder.repairCountSource).toBe('manual');
    expectValidationField(
      () =>
        parseCreateWorkOrderBody({
          board: { boardType: 'SUP' },
          customer: { name: '王小明', phone: '0912345678' },
          customerMode: 'reuse',
          workOrder: {
            intakeDate: '2026-04-20',
          },
        }),
      'customer',
    );
  });

  it('rejects client-supplied paper order numbers when creating work orders', () => {
    expectValidationField(
      () =>
        parseCreateWorkOrderBody({
          board: { boardType: 'SUP' },
          customer: { name: '王小明', phone: '0912345678' },
          customerMode: 'create',
          workOrder: {
            intakeDate: '2026-04-20',
            paperOrderNo: 'BR-2026-0001',
            repairCount: 2,
            repairCountSource: 'manual',
          },
        }),
      'workOrder.paperOrderNo',
    );
  });

  it('accepts only 99-prefixed manual numbers for test work orders', () => {
    const input = parseCreateWorkOrderBody({
      board: { boardType: 'SUP' },
      customer: { name: '王小明', phone: '0912345678' },
      customerMode: 'create',
      paperOrderMode: 'test',
      workOrder: {
        intakeDate: '2026-04-20',
        paperOrderNo: '990001',
        repairCount: 2,
        repairCountSource: 'manual',
      },
    });

    expect(input.paperOrderMode).toBe('test');
    expect(input.workOrder.paperOrderNo).toBe('990001');

    for (const paperOrderNo of ['260001', '99ABC1', '99001']) {
      expectValidationField(
        () =>
          parseCreateWorkOrderBody({
            board: { boardType: 'SUP' },
            customer: { name: '王小明', phone: '0912345678' },
            customerMode: 'create',
            paperOrderMode: 'test',
            workOrder: {
              intakeDate: '2026-04-20',
              paperOrderNo,
              repairCount: 2,
              repairCountSource: 'manual',
            },
          }),
        'workOrder.paperOrderNo',
      );
    }
  });

  it('parses the next-number mode strictly', () => {
    expect(parseNextPaperOrderNoQuery({})).toEqual({ mode: 'standard' });
    expect(parseNextPaperOrderNoQuery({ mode: 'test' })).toEqual({ mode: 'test' });
    expectValidationField(() => parseNextPaperOrderNoQuery({ mode: 'manual' }), 'mode');
    expectValidationField(() => parseNextPaperOrderNoQuery({ mode: 'test', extra: 'x' }), 'extra');
  });

  it('requires a resolved repair count before creating a work order', () => {
    expectValidationField(
      () =>
        parseCreateWorkOrderBody({
          board: {
            boardLengthClass: 'SHORTBOARD',
            boardType: 'SURFBOARD',
          },
          customer: { name: '王小明', phone: '0912345678' },
          customerMode: 'create',
          workOrder: {
            intakeDate: '2026-04-20',
          },
        }),
      'workOrder.repairCount',
    );
  });

  it('requires boardLengthClass for SURFBOARD and rejects it for other board types', () => {
    expectValidationField(
      () =>
        parseCreateWorkOrderBody({
          board: { boardType: 'SURFBOARD' },
          customer: { name: '王小明', phone: '0912345678' },
          customerMode: 'create',
          workOrder: {
            intakeDate: '2026-04-20',
          },
        }),
      'board.boardLengthClass',
    );

    expectValidationField(
      () =>
        parseCreateWorkOrderBody({
          board: {
            boardLengthClass: 'LONGBOARD',
            boardType: 'SUP',
          },
          customer: { name: '王小明', phone: '0912345678' },
          customerMode: 'create',
          workOrder: {
            intakeDate: '2026-04-20',
          },
        }),
      'board.boardLengthClass',
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

  it('calculates Taipei day range with inclusive start and exclusive next day', () => {
    expect(getTaipeiDayRange(new Date('2026-04-29T02:45:00.000Z'))).toEqual({
      endExclusive: '2026-04-29T16:00:00.000Z',
      startInclusive: '2026-04-28T16:00:00.000Z',
    });
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

  it('validates scan quick note payloads', () => {
    expect(parseAdminWorkOrderScanQuickNoteBody({ note: '  現場備註  ' })).toEqual({
      note: '現場備註',
    });
    expectValidationField(() => parseAdminWorkOrderScanQuickNoteBody({}), 'note');
    expectValidationField(
      () => parseAdminWorkOrderScanQuickNoteBody({ note: 'ok', other: true }),
      'other',
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
      mapWorkOrderListRow(
        {
          board_color: 'BLUE',
          board_length_class: 'SHORTBOARD',
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
          repair_count: 2,
          storage_fee_warning_after_days: 14,
          updated_at: '2026-04-20T08:30:00.000Z',
        },
        new Date('2026-04-28T08:30:00.000Z'),
      ),
    ).toMatchObject({
      board: {
        color: 'BLUE',
        boardLengthClass: 'SHORTBOARD',
        boardType: 'SURFBOARD',
        sizeLabel: "6'2",
      },
      customer: { id: 'customer-id', name: '王小明', phone: '0912345678' },
      daysInShop: 8,
      flags: {
        overdueEstimatedCompletion: false,
        pickupOverdue: false,
        staleReceived: false,
      },
      paperOrderNo: 'BR-2026-0001',
      quoteTotalAmount: 700,
      repairCount: 2,
    });
  });

  it('aggregates dashboard summary counts from admin_work_order_list', async () => {
    const now = new Date('2026-04-29T02:45:00.000Z');
    const { client } = createDashboardSummaryClient({
      createdToday: 4,
      drying: 4,
      metricRows: [
        {
          board_length_class: null,
          board_type: 'SUP',
          current_status: 'DELIVERED',
          id: 'work-order-0',
          intake_date: '2026-01-15',
        },
        {
          board_length_class: 'SHORTBOARD',
          board_type: 'SURFBOARD',
          current_status: 'DELIVERED',
          id: 'work-order-1',
          intake_date: '2026-03-10',
        },
        {
          board_length_class: 'MID_LENGTH',
          board_type: 'SURFBOARD',
          current_status: 'REPAIRING',
          id: 'work-order-2',
          intake_date: '2026-04-11',
        },
        {
          board_length_class: null,
          board_type: 'SNOWBOARD',
          current_status: 'RECEIVED',
          id: 'work-order-3',
          intake_date: '2026-04-20',
        },
        {
          board_length_class: null,
          board_type: 'SURFBOARD',
          current_status: 'READY_FOR_PICKUP',
          id: 'work-order-4',
          intake_date: '2026-04-21',
        },
      ],
      overdue: 3,
      readyForPickup: 6,
      received: 5,
      repairing: 9,
    });

    expect(await getAdminDashboardSummary(client as never, now)).toEqual({
      data: {
        generatedAt: '2026-04-29T02:45:00.000Z',
        stats: {
          averageMonthlyIntake: 0.4,
          boardTypeBreakdown: [
            { count: 3, key: 'SURFBOARD', label: '衝浪板', share: 60 },
            { count: 1, key: 'SUP', label: 'SUP', share: 20 },
            { count: 1, key: 'SNOWBOARD', label: '雪板', share: 20 },
          ],
          busiestMonth: {
            count: 3,
            label: '2026/04',
            month: '2026-04',
          },
          last12MonthsIntake: 5,
          last12WeeksIntake: 4,
          monthlyIntake: [
            { count: 0, label: '2025/05', month: '2025-05' },
            { count: 0, label: '2025/06', month: '2025-06' },
            { count: 0, label: '2025/07', month: '2025-07' },
            { count: 0, label: '2025/08', month: '2025-08' },
            { count: 0, label: '2025/09', month: '2025-09' },
            { count: 0, label: '2025/10', month: '2025-10' },
            { count: 0, label: '2025/11', month: '2025-11' },
            { count: 0, label: '2025/12', month: '2025-12' },
            { count: 1, label: '2026/01', month: '2026-01' },
            { count: 0, label: '2026/02', month: '2026-02' },
            { count: 1, label: '2026/03', month: '2026-03' },
            { count: 3, label: '2026/04', month: '2026-04' },
          ],
          receivedPreviousMonth: 1,
          receivedPreviousWeek: 2,
          receivedThisMonth: 3,
          receivedThisWeek: 0,
          statusBreakdown: [
            { count: 5, key: 'RECEIVED', label: '已收件', share: 21 },
            { count: 4, key: 'DRYING', label: '除濕中', share: 17 },
            { count: 9, key: 'REPAIRING', label: '維修中', share: 38 },
            { count: 6, key: 'READY_FOR_PICKUP', label: '待取件', share: 25 },
          ],
          surfboardLengthBreakdown: [
            { count: 1, key: 'SHORTBOARD', label: '短板', share: 50 },
            { count: 1, key: 'MID_LENGTH', label: '中長板', share: 50 },
            { count: 0, key: 'LONGBOARD', label: '長板', share: 0 },
          ],
          weeklyIntake: [
            {
              count: 0,
              endDate: '2026-02-15',
              label: '02/09',
              startDate: '2026-02-09',
              week: '2026-02-09',
            },
            {
              count: 0,
              endDate: '2026-02-22',
              label: '02/16',
              startDate: '2026-02-16',
              week: '2026-02-16',
            },
            {
              count: 0,
              endDate: '2026-03-01',
              label: '02/23',
              startDate: '2026-02-23',
              week: '2026-02-23',
            },
            {
              count: 0,
              endDate: '2026-03-08',
              label: '03/02',
              startDate: '2026-03-02',
              week: '2026-03-02',
            },
            {
              count: 1,
              endDate: '2026-03-15',
              label: '03/09',
              startDate: '2026-03-09',
              week: '2026-03-09',
            },
            {
              count: 0,
              endDate: '2026-03-22',
              label: '03/16',
              startDate: '2026-03-16',
              week: '2026-03-16',
            },
            {
              count: 0,
              endDate: '2026-03-29',
              label: '03/23',
              startDate: '2026-03-23',
              week: '2026-03-23',
            },
            {
              count: 0,
              endDate: '2026-04-05',
              label: '03/30',
              startDate: '2026-03-30',
              week: '2026-03-30',
            },
            {
              count: 1,
              endDate: '2026-04-12',
              label: '04/06',
              startDate: '2026-04-06',
              week: '2026-04-06',
            },
            {
              count: 0,
              endDate: '2026-04-19',
              label: '04/13',
              startDate: '2026-04-13',
              week: '2026-04-13',
            },
            {
              count: 2,
              endDate: '2026-04-26',
              label: '04/20',
              startDate: '2026-04-20',
              week: '2026-04-20',
            },
            {
              count: 0,
              endDate: '2026-05-03',
              label: '04/27',
              startDate: '2026-04-27',
              week: '2026-04-27',
            },
          ],
        },
        summary: {
          activeWorkOrders: 18,
          activeWorkOrdersByStatus: {
            RECEIVED: 5,
            DRYING: 4,
            REPAIRING: 9,
          },
          createdToday: 4,
          overdue: 3,
          readyForPickup: 6,
        },
      },
    });
  });

  it('maps resolve rows to the camelCase API contract', () => {
    expect(
      mapWorkOrderResolveRow({
        board_color: 'GREEN',
        board_length_class: 'SHORTBOARD',
        board_size_label: "6'2",
        board_type: 'SURFBOARD',
        current_status: 'REPAIRING',
        customer_id: 'customer-id',
        customer_name: '王小明',
        customer_phone: '0912345678',
        estimated_completion_date: '2026-04-26',
        id: 'work-order-id',
        is_overdue_estimated_completion: false,
        is_pickup_overdue: false,
        latest_received_at: '2026-04-20T08:00:00.000Z',
        paper_order_no: 'BR-2026-0001',
        updated_at: '2026-04-20T08:30:00.000Z',
      }),
    ).toEqual({
      board: {
        color: 'GREEN',
        boardLengthClass: 'SHORTBOARD',
        boardType: 'SURFBOARD',
        sizeLabel: "6'2",
      },
      currentStatus: 'REPAIRING',
      customer: {
        id: 'customer-id',
        name: '王小明',
        phone: '0912345678',
      },
      estimatedCompletionDate: '2026-04-26',
      flags: {
        overdueEstimatedCompletion: false,
        pickupOverdue: false,
        staleReceived: false,
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

    expect(calls.table).toBe('admin_work_order_list');
    expect(calls.eq).toEqual({
      column: 'paper_order_no',
      value: 'BR-2026-0001',
    });
  });

  it('loads the next generated paper order number from the database helper', async () => {
    const calls: Array<{ args: Record<string, unknown>; name: string }> = [];
    const client = {
      rpc(name: string, args: Record<string, unknown>) {
        calls.push({ args, name });
        return Promise.resolve({ data: '260005', error: null });
      },
    };

    await expect(getNextAdminPaperOrderNo(client as never)).resolves.toEqual({
      data: {
        paperOrderNo: '260005',
      },
    });
    expect(calls).toEqual([
      {
        args: { p_lock: false },
        name: 'get_next_admin_paper_order_no',
      },
    ]);

    await expect(getNextAdminPaperOrderNo(client as never, 'test')).resolves.toEqual({
      data: {
        paperOrderNo: '260005',
      },
    });
    expect(calls.at(-1)).toEqual({
      args: { p_lock: false },
      name: 'get_next_admin_test_paper_order_no',
    });
  });

  it('deletes newly received work orders through the guarded RPC', async () => {
    const calls: Array<{ args: Record<string, unknown>; name: string }> = [];
    const client = {
      rpc(name: string, args: Record<string, unknown>) {
        calls.push({ args, name });
        return Promise.resolve({
          data: {
            deletedAt: '2026-06-12T06:30:00.000Z',
            id: 'work-order-1',
            paperOrderNo: '260005',
          },
          error: null,
        });
      },
    };

    await expect(deleteAdminWorkOrder(client as never, 'work-order-1')).resolves.toEqual({
      data: {
        deletedAt: '2026-06-12T06:30:00.000Z',
        id: 'work-order-1',
        paperOrderNo: '260005',
      },
    });
    expect(calls).toEqual([
      {
        args: { p_work_order_id: 'work-order-1' },
        name: 'delete_admin_work_order',
      },
    ]);
  });

  it('maps delete guard database errors to conflicts', () => {
    expect(() =>
      throwMappedSupabaseError({
        code: '23514',
        message: 'Only RECEIVED work orders can be deleted',
      }),
    ).toThrow(ConflictError);
    expect(() =>
      throwMappedSupabaseError({
        code: '23514',
        message: 'Work order has active or printed print jobs',
      }),
    ).toThrow(ConflictError);
  });

  it('maps status transition RPC results to the camelCase API contract', () => {
    expect(
      mapStatusTransitionResult({
        lineNotification: {
          enqueued: true,
          jobId: 'line-job-id',
        },
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
      lineNotification: {
        enqueued: true,
        jobId: 'line-job-id',
      },
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

  it('maps a non-enqueued READY notification reason', () => {
    const result = mapStatusTransitionResult({
      lineNotification: {
        enqueued: false,
        reason: 'JOB_ALREADY_EXISTS',
      },
      statusHistory: {
        changedAt: '2026-04-22T10:01:00.000Z',
        id: 'status-history-id',
        note: null,
        status: 'READY_FOR_PICKUP',
      },
      workOrder: {
        cancelledAt: null,
        currentStatus: 'READY_FOR_PICKUP',
        deliveredAt: null,
        id: 'work-order-id',
        paperOrderNo: '260001',
        readyForPickupAt: '2026-04-22T10:01:00.000Z',
        updatedAt: '2026-04-22T10:01:00.000Z',
      },
    });

    expect(result.lineNotification).toEqual({
      enqueued: false,
      reason: 'JOB_ALREADY_EXISTS',
    });
  });

  it('derives scan-page actions from the current status', () => {
    expect(getAdminWorkOrderScanAvailableActions('RECEIVED')).toEqual([
      'update_status',
      'add_note',
      'open_detail',
    ]);
    expect(getAdminWorkOrderScanAvailableActions('READY_FOR_PICKUP')).toEqual([
      'mark_paid',
      'mark_delivered',
      'add_note',
      'open_detail',
    ]);
    expect(getAdminWorkOrderScanAvailableActions('DELIVERED')).toEqual(['open_detail']);
  });

  it('filters scan-page status transitions by board type', () => {
    expect(getAdminWorkOrderScanAvailableStatusTransitions('RECEIVED', 'SURFBOARD')).toEqual([
      'DRYING',
      'REPAIRING',
    ]);
    expect(getAdminWorkOrderScanAvailableStatusTransitions('RECEIVED', 'SUP')).toEqual([
      'DRYING',
      'REPAIRING',
    ]);
    expect(getAdminWorkOrderScanAvailableStatusTransitions('RECEIVED', 'SNOWBOARD')).toEqual([
      'REPAIRING',
    ]);
    expect(getAdminWorkOrderScanAvailableStatusTransitions('DRYING', 'SNOWBOARD')).toEqual([
      'REPAIRING',
    ]);
  });

  it('maps recent scan history with from/to statuses and reverse chronological order', () => {
    expect(
      mapScanRecentHistory([
        {
          changed_at: '2026-06-01T10:00:00.000Z',
          id: 'history-1',
          note: null,
          status: 'RECEIVED',
        },
        {
          changed_at: '2026-06-05T10:00:00.000Z',
          id: 'history-2',
          note: '開始除濕',
          status: 'DRYING',
        },
        {
          changed_at: '2026-06-06T10:00:00.000Z',
          id: 'history-3',
          note: '進入維修',
          status: 'REPAIRING',
        },
        {
          changed_at: '2026-06-08T10:00:00.000Z',
          id: 'history-4',
          note: '待客取件',
          status: 'READY_FOR_PICKUP',
        },
      ]),
    ).toEqual([
      {
        changedAt: '2026-06-08T10:00:00.000Z',
        fromStatus: 'REPAIRING',
        id: 'history-4',
        note: '待客取件',
        toStatus: 'READY_FOR_PICKUP',
      },
      {
        changedAt: '2026-06-06T10:00:00.000Z',
        fromStatus: 'DRYING',
        id: 'history-3',
        note: '進入維修',
        toStatus: 'REPAIRING',
      },
      {
        changedAt: '2026-06-05T10:00:00.000Z',
        fromStatus: 'RECEIVED',
        id: 'history-2',
        note: '開始除濕',
        toStatus: 'DRYING',
      },
    ]);
  });

  it('appends scan quick notes without overwriting existing internal notes', async () => {
    const { calls, client } = createQuickNoteClient({
      selectResult: {
        data: {
          id: 'work-order-id',
          internal_note: '原始備註',
          updated_at: '2026-06-09T12:00:00.000Z',
        },
        error: null,
      },
      updateResult: {
        data: {
          id: 'work-order-id',
          internal_note: '原始備註\n新增現場備註',
          updated_at: '2026-06-09T12:05:00.000Z',
        },
        error: null,
      },
    });

    const result = await appendAdminWorkOrderScanQuickNote(
      client as Parameters<typeof appendAdminWorkOrderScanQuickNote>[0],
      'work-order-id',
      {
        note: '新增現場備註',
      },
    );

    expect(calls.selectCalls).toEqual([
      {
        filters: [{ column: 'id', value: 'work-order-id' }],
        table: 'work_orders',
      },
    ]);
    expect(calls.updatePayloads).toEqual([
      {
        filters: [{ column: 'id', value: 'work-order-id' }],
        payload: {
          internal_note: '原始備註\n新增現場備註',
        },
        table: 'work_orders',
      },
    ]);
    expect(result).toEqual({
      data: {
        id: 'work-order-id',
        internalNote: '原始備註\n新增現場備註',
        updatedAt: '2026-06-09T12:05:00.000Z',
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
              lineNotification: {
                enqueued: false,
                reason: 'NOT_READY_FOR_PICKUP',
              },
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
              lineNotification: {
                enqueued: false,
                reason: 'NOT_READY_FOR_PICKUP',
              },
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
            lineNotification: {
              enqueued: false,
              reason: 'NOT_READY_FOR_PICKUP',
            },
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
