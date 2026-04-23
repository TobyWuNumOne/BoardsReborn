import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../server/utils/api-errors';
import { normalizeTaiwanMobilePhone } from '../../server/utils/phone';
import { throwMappedSupabaseError } from '../../server/utils/supabase-errors';
import {
  buildWorkOrderPatchUpdates,
  getStaleReceivedDays,
  mapStatusTransitionResult,
  mapWorkOrderListRow,
} from '../../server/utils/work-orders';
import {
  WORK_ORDER_LIST_SORT_FIELDS,
  parseCreateWorkOrderBody,
  parseCustomerLookupQuery,
  parsePatchWorkOrderBody,
  parseStatusTransitionBody,
  parseUuid,
  parseWorkOrderListQuery,
} from '../../server/utils/work-order-validation';

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
});
