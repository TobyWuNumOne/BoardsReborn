import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Database } from '../../types/database.types';
import { ConflictError, NotFoundError, ValidationError } from '../../server/utils/api-errors';
import {
  getAdminCustomerDetail,
  listAdminCustomers,
  transferAdminWorkOrderCustomer,
  updateAdminCustomer,
} from '../../server/utils/admin-customers';
import {
  parseAdminCustomerListQuery,
  parseAdminCustomerDetailQuery,
  parseAdminCustomerUpdateBody,
  parseWorkOrderTransferCustomerBody,
} from '../../server/utils/work-order-validation';

const CUSTOMER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_CUSTOMER_ID = '22222222-2222-4222-8222-222222222222';
const WORK_ORDER_ID = '33333333-3333-4333-8333-333333333333';
type TransferAdminWorkOrderCustomerFunction =
  Database['public']['Functions']['transfer_admin_work_order_customer'];
type TransferAdminWorkOrderCustomerArgs = TransferAdminWorkOrderCustomerFunction['Args'];
type TransferAdminWorkOrderCustomerReturn = TransferAdminWorkOrderCustomerFunction['Returns'][number];
const transferRpcArgsTypeCheck: TransferAdminWorkOrderCustomerArgs = {
  p_target_customer_id: OTHER_CUSTOMER_ID,
  p_work_order_id: WORK_ORDER_ID,
};
const transferRpcReturnTypeCheck: TransferAdminWorkOrderCustomerReturn = {
  previous_customer_id: CUSTOMER_ID,
  target_customer_id: OTHER_CUSTOMER_ID,
  transferred_at: '2026-06-11T12:00:00.000Z',
  work_order_id: WORK_ORDER_ID,
};
void transferRpcArgsTypeCheck;
void transferRpcReturnTypeCheck;

const expectValidationField = (callback: () => unknown, field: string) => {
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).fieldErrors).toHaveProperty(field);
    return;
  }

  throw new Error('Expected ValidationError');
};

const createListClient = (result: { count: number | null; data: unknown[]; error: unknown }) => {
  const calls = {
    eq: [] as Array<{ column: string; value: unknown }>,
    ilike: [] as Array<{ column: string; value: string }>,
    order: [] as Array<{ ascending?: boolean; column: string; nullsFirst?: boolean }>,
    range: { from: -1, to: -1 },
    select: { columns: '', options: {} as Record<string, unknown> },
    table: '',
  };

  const query = {
    eq(column: string, value: unknown) {
      calls.eq.push({ column, value });
      return query;
    },
    ilike(column: string, value: string) {
      calls.ilike.push({ column, value });
      return query;
    },
    order(column: string, options: { ascending?: boolean; nullsFirst?: boolean }) {
      calls.order.push({ column, ...options });
      return query;
    },
    range(from: number, to: number) {
      calls.range = { from, to };
      return Promise.resolve(result);
    },
    select(columns: string, options: Record<string, unknown>) {
      calls.select = { columns, options };
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

const createDetailClient = ({
  customer,
  line,
  workOrders,
}: {
  customer: { data: unknown; error: unknown };
  line: { data: unknown; error: unknown };
  workOrders: { count: number | null; data: unknown[]; error: unknown };
}) => {
  const calls = {
    customerSelect: '',
    lineSelect: '',
    lineTable: '',
    workOrders: {
      eq: [] as Array<{ column: string; value: unknown }>,
      order: [] as Array<{ ascending?: boolean; column: string; nullsFirst?: boolean }>,
      range: { from: -1, to: -1 },
      select: '',
      table: '',
    },
  };

  const customerQuery = {
    eq() {
      return customerQuery;
    },
    maybeSingle() {
      return Promise.resolve(customer);
    },
    select(columns: string) {
      calls.customerSelect = columns;
      return customerQuery;
    },
  };

  const lineQuery = {
    eq() {
      return lineQuery;
    },
    maybeSingle() {
      return Promise.resolve(line);
    },
    select(columns: string) {
      calls.lineSelect = columns;
      return lineQuery;
    },
  };

  const workOrderQuery = {
    eq(column: string, value: unknown) {
      calls.workOrders.eq.push({ column, value });
      return workOrderQuery;
    },
    order(column: string, options: { ascending?: boolean; nullsFirst?: boolean }) {
      calls.workOrders.order.push({ column, ...options });
      return workOrderQuery;
    },
    range(from: number, to: number) {
      calls.workOrders.range = { from, to };
      return Promise.resolve(workOrders);
    },
    select(columns: string) {
      calls.workOrders.select = columns;
      return workOrderQuery;
    },
  };

  return {
    calls,
    client: {
      from(table: string) {
        if (table === 'customers') {
          return customerQuery;
        }

        if (table === 'customer_line_accounts') {
          calls.lineTable = table;
          return lineQuery;
        }

        if (table === 'admin_work_order_list') {
          calls.workOrders.table = table;
          return workOrderQuery;
        }

        throw new Error(`Unexpected table ${table}`);
      },
    },
  };
};

const createUpdateClient = (result: { data: unknown; error: unknown }) => {
  const calls = {
    eq: { column: '', value: '' },
    payload: {} as Record<string, unknown>,
    select: '',
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
    select(columns: string) {
      calls.select = columns;
      return query;
    },
  };

  return {
    calls,
    client: {
      from(table: string) {
        calls.table = table;
        return {
          update(payload: Record<string, unknown>) {
            calls.payload = payload;
            return query;
          },
        };
      },
    },
  };
};

describe('admin customer validation', () => {
  it('keeps customer management routes admin-only and wired to the expected parsers/helpers', () => {
    const routeChecks = [
      {
        includes: [
          'defineApiHandler',
          'requireAdminContext(event)',
          'parseAdminCustomerListQuery(getQuery(event))',
          'listAdminCustomers(supabase, query)',
        ],
        path: 'server/api/admin/customers/index.get.ts',
      },
      {
        includes: [
          'defineApiHandler',
          'requireAdminContext(event)',
          "parseUuid(getRouterParam(event, 'id'), 'id')",
          'parseAdminCustomerDetailQuery(getQuery(event))',
          'getAdminCustomerDetail(supabase, id, query)',
        ],
        path: 'server/api/admin/customers/[id].get.ts',
      },
      {
        includes: [
          'defineApiHandler',
          'requireAdminContext(event)',
          "parseUuid(getRouterParam(event, 'id'), 'id')",
          'parseAdminCustomerUpdateBody(await readBody(event))',
          'updateAdminCustomer(supabase, id, body)',
        ],
        path: 'server/api/admin/customers/[id].patch.ts',
      },
      {
        includes: [
          'defineApiHandler',
          'requireAdminContext(event)',
          "parseUuid(getRouterParam(event, 'id'), 'id')",
          'parseWorkOrderTransferCustomerBody(await readBody(event))',
          'transferAdminWorkOrderCustomer(supabase, id, body.targetCustomerId)',
        ],
        path: 'server/api/admin/work-orders/[id]/transfer-customer.post.ts',
      },
    ];

    for (const routeCheck of routeChecks) {
      const source = readFileSync(resolve(process.cwd(), routeCheck.path), 'utf8');

      for (const fragment of routeCheck.includes) {
        expect(source).toContain(fragment);
      }
    }
  });

  it('parses list filters with defaults', () => {
    expect(parseAdminCustomerListQuery({ q: '0912', page: '2', lineStatus: 'linked' })).toEqual({
      lineStatus: 'linked',
      page: 2,
      pageSize: 20,
      q: '0912',
      sort: 'updatedAt:desc',
    });
  });

  it('parses detail filters with defaults', () => {
    expect(parseAdminCustomerDetailQuery({})).toEqual({
      page: 1,
      pageSize: 20,
    });
  });

  it('parses detail query with explicit page and pageSize', () => {
    expect(parseAdminCustomerDetailQuery({ page: '2', pageSize: '50' })).toEqual({
      page: 2,
      pageSize: 50,
    });
  });

  it('rejects invalid lineStatus values', () => {
    expectValidationField(() => parseAdminCustomerListQuery({ lineStatus: 'bad' }), 'lineStatus');
  });

  it('rejects list unknown fields', () => {
    expectValidationField(() => parseAdminCustomerListQuery({ q: '0912', extra: 'x' }), 'extra');
  });

  it('rejects detail unknown fields', () => {
    expectValidationField(() => parseAdminCustomerDetailQuery({ unknown: 'bad' }), 'unknown');
  });

  it('rejects pageSize greater than 100 for list query', () => {
    expectValidationField(() => parseAdminCustomerListQuery({ pageSize: '101' }), 'pageSize');
  });

  it('rejects pageSize greater than 100 for detail query', () => {
    expectValidationField(() => parseAdminCustomerDetailQuery({ pageSize: '101' }), 'pageSize');
  });

  it('normalizes update payload phone and empty note', () => {
    expect(
      parseAdminCustomerUpdateBody({
        name: '王小明',
        note: '',
        phone: '0912-345-678',
      }),
    ).toEqual({
      name: '王小明',
      note: null,
      phone: '0912345678',
    });
  });

  it('rejects invalid update phones and unknown fields', () => {
    expectValidationField(
      () =>
        parseAdminCustomerUpdateBody({
          name: '王小明',
          note: '',
          phone: '02-1234-5678',
        }),
      'phone',
    );
    expectValidationField(
      () =>
        parseAdminCustomerUpdateBody({
          extra: true,
          name: '王小明',
          note: '',
          phone: '0912345678',
        }),
      'extra',
    );
  });

  it('parses transfer body and rejects unknown fields', () => {
    expect(
      parseWorkOrderTransferCustomerBody({
        targetCustomerId: OTHER_CUSTOMER_ID,
      }),
    ).toEqual({
      targetCustomerId: OTHER_CUSTOMER_ID,
    });

    expectValidationField(
      () =>
        parseWorkOrderTransferCustomerBody({
          targetCustomerId: OTHER_CUSTOMER_ID,
          workOrderId: WORK_ORDER_ID,
        }),
      'workOrderId',
    );
  });
});

describe('admin customer services', () => {
  it('lists customers from admin_customer_list with search, line filter, and safe mapping', async () => {
    const { calls, client } = createListClient({
      count: 3,
      data: [
        {
          active_work_order_count: 1,
          created_at: '2026-06-01T10:00:00.000Z',
          id: CUSTOMER_ID,
          latest_paper_order_no: '260001',
          latest_work_order_id: WORK_ORDER_ID,
          latest_work_order_status: 'REPAIRING',
          latest_work_order_updated_at: '2026-06-10T11:00:00.000Z',
          line_blocked_at: null,
          line_display_name: '王小明',
          line_friendship_checked_at: '2026-06-10T10:00:00.000Z',
          line_is_friend: true,
          line_linked: true,
          line_notify_status: 'notifyable',
          name: '王小明',
          normalized_phone: '0912345678',
          note: '老客戶',
          phone: '0912345678',
          updated_at: '2026-06-10T11:00:00.000Z',
          work_order_count: 2,
        },
      ],
      error: null,
    });

    const response = await listAdminCustomers(client as never, {
      lineStatus: 'linked',
      page: 2,
      pageSize: 2,
      q: '0912',
      sort: 'updatedAt:desc',
    });

    expect(calls.table).toBe('admin_customer_list');
    expect(calls.select.columns).not.toBe('*');
    expect(calls.select.columns).toContain('line_notify_status');
    expect(calls.select.columns).not.toContain('line_user_id');
    expect(calls.ilike).toEqual([{ column: 'search_text', value: '%0912%' }]);
    expect(calls.eq).toEqual([{ column: 'line_linked', value: true }]);
    expect(calls.order).toEqual([
      { ascending: false, column: 'updated_at', nullsFirst: false },
      { ascending: true, column: 'id' },
    ]);
    expect(calls.range).toEqual({ from: 2, to: 3 });
    expect(response).toEqual({
      data: [
        {
          activeWorkOrderCount: 1,
          createdAt: '2026-06-01T10:00:00.000Z',
          id: CUSTOMER_ID,
          latestWorkOrder: {
            currentStatus: 'REPAIRING',
            id: WORK_ORDER_ID,
            paperOrderNo: '260001',
            updatedAt: '2026-06-10T11:00:00.000Z',
          },
          line: {
            blockedAt: null,
            displayName: '王小明',
            friendshipCheckedAt: '2026-06-10T10:00:00.000Z',
            isFriend: true,
            linkedAt: null,
            notificationStatus: 'notifyable',
            status: 'bound',
          },
          name: '王小明',
          note: '老客戶',
          phone: '0912345678',
          updatedAt: '2026-06-10T11:00:00.000Z',
          workOrderCount: 2,
        },
      ],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: true,
        page: 2,
        pageSize: 2,
        total: 3,
        totalPages: 2,
      },
    });
    expect(JSON.stringify(response)).not.toContain('line_user_id');
    expect(JSON.stringify(response)).not.toContain('token_hash');
  });

  it('escapes list search LIKE wildcards and PostgREST OR delimiters by avoiding raw or filters', async () => {
    const { calls, client } = createListClient({
      count: 0,
      data: [],
      error: null,
    });

    await listAdminCustomers(client as never, {
      lineStatus: 'all',
      page: 1,
      pageSize: 20,
      q: '王%,_(),',
      sort: 'updatedAt:desc',
    });

    expect(calls.ilike).toEqual([{ column: 'search_text', value: '%王\\%,\\_(),%' }]);
  });

  it('maps checked non-friend LINE state consistently in list and detail summaries', async () => {
    const { client: listClient } = createListClient({
      count: 1,
      data: [
        {
          active_work_order_count: 0,
          created_at: '2026-06-01T10:00:00.000Z',
          id: CUSTOMER_ID,
          latest_paper_order_no: null,
          latest_work_order_id: null,
          latest_work_order_status: null,
          latest_work_order_updated_at: null,
          line_blocked_at: null,
          line_display_name: '王小明',
          line_friendship_checked_at: '2026-06-10T10:00:00.000Z',
          line_is_friend: false,
          line_linked: true,
          line_notify_status: 'not_notifyable',
          name: '王小明',
          note: null,
          phone: '0912345678',
          updated_at: '2026-06-10T11:00:00.000Z',
          work_order_count: 0,
        },
      ],
      error: null,
    });

    const listResponse = await listAdminCustomers(listClient as never, {
      lineStatus: 'not_notifyable',
      page: 1,
      pageSize: 20,
      sort: 'updatedAt:desc',
    });

    const { client: detailClient } = createDetailClient({
      customer: {
        data: {
          created_at: '2026-06-01T10:00:00.000Z',
          id: CUSTOMER_ID,
          name: '王小明',
          note: null,
          phone: '0912345678',
          updated_at: '2026-06-10T11:00:00.000Z',
        },
        error: null,
      },
      line: {
        data: {
          blocked_at: null,
          display_name: '王小明',
          friendship_checked_at: '2026-06-10T10:00:00.000Z',
          is_friend: false,
          last_seen_at: null,
          linked_at: '2026-06-05T10:00:00.000Z',
        },
        error: null,
      },
      workOrders: {
        count: 0,
        data: [],
        error: null,
      },
    });

    const detailResponse = await getAdminCustomerDetail(detailClient as never, CUSTOMER_ID, {
      page: 1,
      pageSize: 20,
    });

    expect(listResponse.data[0]?.line.notificationStatus).toBe('not_notifyable');
    expect(detailResponse.data.line.notificationStatus).toBe('not_notifyable');
  });

  it('loads customer detail with safe line summary and embedded work-order pageInfo', async () => {
    const { calls, client } = createDetailClient({
      customer: {
        data: {
          created_at: '2026-06-01T10:00:00.000Z',
          id: CUSTOMER_ID,
          name: '王小明',
          note: '老客戶',
          phone: '0912345678',
          updated_at: '2026-06-10T11:00:00.000Z',
        },
        error: null,
      },
      line: {
        data: {
          blocked_at: null,
          display_name: '王小明',
          friendship_checked_at: '2026-06-10T10:00:00.000Z',
          is_friend: true,
          last_seen_at: null,
          linked_at: '2026-06-05T10:00:00.000Z',
        },
        error: null,
      },
      workOrders: {
        count: 1,
        data: [
          {
            board_color: 'WHITE',
            board_length_class: 'SHORTBOARD',
            board_type: 'SURFBOARD',
            current_status: 'REPAIRING',
            id: WORK_ORDER_ID,
            intake_date: '2026-06-02',
            paper_order_no: '260001',
            repair_count: 2,
            updated_at: '2026-06-10T11:00:00.000Z',
          },
        ],
        error: null,
      },
    });

    const response = await getAdminCustomerDetail(client as never, CUSTOMER_ID, {
      page: 1,
      pageSize: 10,
    });

    expect(calls.customerSelect).toBe('id, name, phone, note, created_at, updated_at');
    expect(calls.lineTable).toBe('customer_line_accounts');
    expect(calls.lineSelect).toBe(
      'display_name, linked_at, last_seen_at, friendship_checked_at, is_friend, blocked_at',
    );
    expect(calls.workOrders.table).toBe('admin_work_order_list');
    expect(calls.workOrders.select).toBe(
      'id, paper_order_no, current_status, board_type, board_length_class, board_color, repair_count, intake_date, updated_at',
    );
    expect(calls.workOrders.eq).toEqual([{ column: 'customer_id', value: CUSTOMER_ID }]);
    expect(calls.workOrders.order).toEqual([
      { ascending: false, column: 'updated_at', nullsFirst: false },
      { ascending: false, column: 'id', nullsFirst: false },
    ]);
    expect(response).toEqual({
      data: {
        customer: {
          createdAt: '2026-06-01T10:00:00.000Z',
          id: CUSTOMER_ID,
          name: '王小明',
          note: '老客戶',
          phone: '0912345678',
          updatedAt: '2026-06-10T11:00:00.000Z',
        },
        line: {
          blockedAt: null,
          displayName: '王小明',
          friendshipCheckedAt: '2026-06-10T10:00:00.000Z',
          isFriend: true,
          linkedAt: '2026-06-05T10:00:00.000Z',
          notificationStatus: 'notifyable',
          status: 'bound',
        },
        workOrders: {
          data: [
            {
              boardColor: 'WHITE',
              boardLengthClass: 'SHORTBOARD',
              boardType: 'SURFBOARD',
              currentStatus: 'REPAIRING',
              id: WORK_ORDER_ID,
              intakeDate: '2026-06-02',
              paperOrderNo: '260001',
              repairCount: 2,
              updatedAt: '2026-06-10T11:00:00.000Z',
            },
          ],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            page: 1,
            pageSize: 10,
            total: 1,
            totalPages: 1,
          },
        },
      },
    });
  });

  it('updates customers with normalized phone values only', async () => {
    const { calls, client } = createUpdateClient({
      data: {
        created_at: '2026-06-01T10:00:00.000Z',
        id: CUSTOMER_ID,
        name: '王小明',
        note: null,
        phone: '0912345678',
        updated_at: '2026-06-11T10:00:00.000Z',
      },
      error: null,
    });

    const response = await updateAdminCustomer(client as never, CUSTOMER_ID, {
      name: '王小明',
      note: null,
      phone: '0912345678',
    });

    expect(calls.table).toBe('customers');
    expect(calls.payload).toEqual({
      name: '王小明',
      note: null,
      phone: '0912345678',
    });
    expect(calls.eq).toEqual({ column: 'id', value: CUSTOMER_ID });
    expect(response).toEqual({
      data: {
        createdAt: '2026-06-01T10:00:00.000Z',
        id: CUSTOMER_ID,
        name: '王小明',
        note: null,
        phone: '0912345678',
        updatedAt: '2026-06-11T10:00:00.000Z',
      },
    });
  });

  it('maps missing customer updates to NOT_FOUND', async () => {
    const { client } = createUpdateClient({
      data: null,
      error: null,
    });

    await expect(
      updateAdminCustomer(client as never, CUSTOMER_ID, {
        name: '王小明',
        note: null,
        phone: '0912345678',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('transfers work orders through the RPC and maps validation conflict failures', async () => {
    const calls: Array<{ args: Record<string, unknown>; name: string }> = [];
    const successClient = {
      async rpc(name: string, args: Record<string, unknown>) {
        calls.push({ args, name });
        return {
          data: [
            {
              previous_customer_id: CUSTOMER_ID,
              target_customer_id: OTHER_CUSTOMER_ID,
              transferred_at: '2026-06-11T12:00:00.000Z',
              work_order_id: WORK_ORDER_ID,
            },
          ],
          error: null,
        };
      },
    };

    await expect(
      transferAdminWorkOrderCustomer(successClient as never, WORK_ORDER_ID, OTHER_CUSTOMER_ID),
    ).resolves.toEqual({
      data: {
        previousCustomerId: CUSTOMER_ID,
        targetCustomerId: OTHER_CUSTOMER_ID,
        transferredAt: '2026-06-11T12:00:00.000Z',
        workOrderId: WORK_ORDER_ID,
      },
    });
    expect(calls).toEqual([
      {
        args: {
          p_target_customer_id: OTHER_CUSTOMER_ID,
          p_work_order_id: WORK_ORDER_ID,
        },
        name: 'transfer_admin_work_order_customer',
      },
    ]);

    const sameCustomerClient = {
      async rpc() {
        return {
          data: null,
          error: { code: '23514', message: 'Target customer must be different' },
        };
      },
    };

    await expect(
      transferAdminWorkOrderCustomer(sameCustomerClient as never, WORK_ORDER_ID, CUSTOMER_ID),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      fieldErrors: {
        targetCustomerId: ['Must be different from the current customer.'],
      },
    });

    const lineArtifactClient = {
      async rpc() {
        return {
          data: null,
          error: { code: '23503', message: 'Work order has LINE bind tokens' },
        };
      },
    };

    await expect(
      transferAdminWorkOrderCustomer(lineArtifactClient as never, WORK_ORDER_ID, OTHER_CUSTOMER_ID),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('maps LINE jobs conflict to ConflictError', async () => {
    const lineJobsClient = {
      async rpc() {
        return {
          data: null,
          error: { code: '23503', message: 'Work order has LINE jobs' },
        };
      },
    };

    await expect(
      transferAdminWorkOrderCustomer(lineJobsClient as never, WORK_ORDER_ID, OTHER_CUSTOMER_ID),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
