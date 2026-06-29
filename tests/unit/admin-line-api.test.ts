import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CustomerAlreadyBoundError,
  NoActiveLineBindingError,
  NotFoundError,
  ValidationError,
} from '../../server/utils/api-errors';
import {
  deriveLineNotificationStatus,
  issueAdminCustomerLineBindToken,
  issueAdminWorkOrderLineBindToken,
  mapAdminWorkOrderLineStatus,
  parseAdminLineBindTokenBody,
  unlinkAdminCustomerLineBinding,
} from '../../server/utils/admin-line-bindings';
import { resolveLineBindTokenConfig } from '../../server/utils/line-bind-tokens';

const TOKEN_ID = '11111111-1111-4111-8111-111111111111';
const WORK_ORDER_ID = '22222222-2222-4222-8222-222222222222';
const CUSTOMER_ID = '33333333-3333-4333-8333-333333333333';
const USER_ID = '44444444-4444-4444-8444-444444444444';

describe('admin LINE API validation and routing', () => {
  it('accepts an empty issue body and rejects unknown fields', () => {
    expect(parseAdminLineBindTokenBody(undefined)).toEqual({});
    expect(parseAdminLineBindTokenBody({})).toEqual({});
    expect(() => parseAdminLineBindTokenBody({ print: true })).toThrow(ValidationError);
  });

  it('defines specific management error codes', () => {
    expect(new CustomerAlreadyBoundError()).toMatchObject({
      code: 'CUSTOMER_ALREADY_BOUND',
      statusCode: 409,
    });
    expect(new NoActiveLineBindingError()).toMatchObject({
      code: 'NO_ACTIVE_LINE_BINDING',
      statusCode: 404,
    });
  });

  it('keeps all LINE management routes admin-only and free of print integration', () => {
    const routePaths = [
      'server/api/admin/work-orders/[id]/line-bind-token.post.ts',
      'server/api/admin/customers/[id]/line-bind-token.post.ts',
      'server/api/admin/customers/[id]/line-binding.delete.ts',
      'server/api/admin/work-orders/[id]/line-status.get.ts',
    ];

    for (const routePath of routePaths) {
      const source = readFileSync(resolve(process.cwd(), routePath), 'utf8');
      expect(source).toContain('requireAdminContext(event)');
      expect(source).not.toContain('printJob');
      expect(source).not.toContain('createAdminPrintJob');
    }
  });

  it('uses the customer-scoped issue route as a thin wrapper over the shared LINE token config flow', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'server/api/admin/customers/[id]/line-bind-token.post.ts'),
      'utf8',
    );

    expect(source).toContain('defineApiHandler');
    expect(source).toContain('requireAdminContext(event)');
    expect(source).toContain("parseUuid(getRouterParam(event, 'id'), 'id')");
    expect(source).toContain('parseAdminLineBindTokenBody(await readBody(event))');
    expect(source).toContain('resolveLineBindTokenConfig');
    expect(source).toContain('issueAdminCustomerLineBindToken');
    expect(source).toContain('setResponseStatus(event, 201)');
  });
});

describe('admin LINE binding mutations', () => {
  const config = resolveLineBindTokenConfig({
    liffId: '1234567890-test',
    lineBindTokenSecret: 'admin-line-bind-secret',
  });

  it('issues a token through the admin transaction without exposing a raw token field', async () => {
    const calls: Array<{ args: Record<string, unknown>; name: string }> = [];
    const client = {
      async rpc(name: string, args: Record<string, unknown>) {
        calls.push({ args, name });
        return {
          data: {
            expiresAt: '2026-07-21T10:00:00.000Z',
            id: TOKEN_ID,
            revokedTokenCount: 1,
          },
          error: null,
        };
      },
    };

    const response = await issueAdminWorkOrderLineBindToken(
      client as never,
      WORK_ORDER_ID,
      USER_ID,
      config,
      TOKEN_ID,
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      args: {
        p_created_by: USER_ID,
        p_token_id: TOKEN_ID,
        p_work_order_id: WORK_ORDER_ID,
      },
      name: 'issue_admin_line_bind_token',
    });
    expect(calls[0]?.args).toHaveProperty('p_token_hash');
    expect(response).toEqual({
      data: {
        expiresAt: '2026-07-21T10:00:00.000Z',
        id: TOKEN_ID,
        liffUrl: expect.stringMatching(/^https:\/\/liff\.line\.me\/1234567890-test\/t\//),
        revokedTokenCount: 1,
      },
    });
    expect(response.data).not.toHaveProperty('plaintextToken');
    expect(response.data).not.toHaveProperty('token');
  });

  it('maps bound-customer RPC failures to CUSTOMER_ALREADY_BOUND', async () => {
    const client = {
      async rpc() {
        return {
          data: null,
          error: { code: '23514', message: 'Customer already has active LINE binding' },
        };
      },
    };

    await expect(
      issueAdminWorkOrderLineBindToken(client as never, WORK_ORDER_ID, USER_ID, config, TOKEN_ID),
    ).rejects.toBeInstanceOf(CustomerAlreadyBoundError);
  });

  it('issues a customer token by resolving the latest work order first and preserving the safe response shape', async () => {
    const fromCalls: Array<{ table: string }> = [];
    const workOrderCalls = {
      eq: [] as Array<{ column: string; value: unknown }>,
      limit: [] as number[],
      order: [] as Array<{ ascending?: boolean; column: string; nullsFirst?: boolean }>,
      select: [] as string[],
    };
    const rpcCalls: Array<{ args: Record<string, unknown>; name: string }> = [];
    const client = {
      from(table: string) {
        fromCalls.push({ table });
        return {
          eq(column: string, value: unknown) {
            workOrderCalls.eq.push({ column, value });
            return this;
          },
          limit(value: number) {
            workOrderCalls.limit.push(value);
            return this;
          },
          maybeSingle() {
            return Promise.resolve({ data: { id: WORK_ORDER_ID }, error: null });
          },
          order(column: string, options: { ascending?: boolean; nullsFirst?: boolean }) {
            workOrderCalls.order.push({ column, ...options });
            return this;
          },
          select(columns: string) {
            workOrderCalls.select.push(columns);
            return this;
          },
        };
      },
      async rpc(name: string, args: Record<string, unknown>) {
        rpcCalls.push({ args, name });
        return {
          data: {
            expiresAt: '2026-07-21T10:00:00.000Z',
            id: TOKEN_ID,
            revokedTokenCount: 1,
          },
          error: null,
        };
      },
    };

    const response = await issueAdminCustomerLineBindToken(
      client as never,
      { customerId: CUSTOMER_ID, userId: USER_ID },
      config,
      TOKEN_ID,
    );

    expect(fromCalls).toEqual([{ table: 'work_orders' }]);
    expect(workOrderCalls.select).toEqual(['id']);
    expect(workOrderCalls.eq).toEqual([{ column: 'customer_id', value: CUSTOMER_ID }]);
    expect(workOrderCalls.order).toEqual([
      { ascending: false, column: 'updated_at', nullsFirst: false },
      { ascending: false, column: 'id', nullsFirst: false },
    ]);
    expect(workOrderCalls.limit).toEqual([1]);
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]).toMatchObject({
      args: {
        p_created_by: USER_ID,
        p_token_id: TOKEN_ID,
        p_work_order_id: WORK_ORDER_ID,
      },
      name: 'issue_admin_line_bind_token',
    });
    expect(rpcCalls[0]?.args).toHaveProperty('p_token_hash');
    expect(response).toEqual({
      data: {
        expiresAt: '2026-07-21T10:00:00.000Z',
        id: TOKEN_ID,
        liffUrl: expect.stringMatching(/^https:\/\/liff\.line\.me\/1234567890-test\/t\//),
        revokedTokenCount: 1,
      },
    });
    expect(response.data).not.toHaveProperty('plaintextToken');
    expect(response.data).not.toHaveProperty('token_hash');
  });

  it('maps customers without work orders to a typed not-found error', async () => {
    const client = {
      from() {
        return {
          eq() {
            return this;
          },
          limit() {
            return this;
          },
          maybeSingle() {
            return Promise.resolve({ data: null, error: null });
          },
          order() {
            return this;
          },
          select() {
            return this;
          },
        };
      },
    };

    const responsePromise = issueAdminCustomerLineBindToken(
      client as never,
      { customerId: CUSTOMER_ID, userId: USER_ID },
      config,
    );

    await expect(responsePromise).rejects.toBeInstanceOf(NotFoundError);
    await expect(responsePromise).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Customer has no work orders for LINE binding.',
    });
  });

  it('unlinks through one RPC and maps its mutation summary', async () => {
    const client = {
      async rpc() {
        return {
          data: {
            customerId: CUSTOMER_ID,
            revokedTokenCount: 1,
            skippedPendingJobCount: 2,
            unlinkedAt: '2026-06-21T10:00:00.000Z',
          },
          error: null,
        };
      },
    };

    await expect(unlinkAdminCustomerLineBinding(client as never, CUSTOMER_ID)).resolves.toEqual({
      data: {
        customerId: CUSTOMER_ID,
        revokedTokenCount: 1,
        skippedPendingJobCount: 2,
        unlinkedAt: '2026-06-21T10:00:00.000Z',
      },
    });
  });

  it('maps missing bindings to NO_ACTIVE_LINE_BINDING', async () => {
    const client = {
      async rpc() {
        return {
          data: null,
          error: { code: 'P0002', message: 'No active LINE binding' },
        };
      },
    };

    await expect(
      unlinkAdminCustomerLineBinding(client as never, CUSTOMER_ID),
    ).rejects.toBeInstanceOf(NoActiveLineBindingError);
  });
});

describe('admin work-order LINE status mapping', () => {
  it.each([
    ['notifyable', { blocked_at: null, is_friend: true, last_seen_at: '2026-06-21T09:00:00Z' }],
    [
      'not_notifyable',
      {
        blocked_at: '2026-06-21T09:00:00Z',
        is_friend: false,
        last_seen_at: '2026-06-21T09:00:00Z',
      },
    ],
    ['unknown', { blocked_at: null, is_friend: false, last_seen_at: null }],
  ] as const)('derives %s notification status', (expected, binding) => {
    expect(deriveLineNotificationStatus(binding)).toBe(expected);
  });

  it('maps bound status without sensitive account, token, or payload fields', () => {
    const recentJobs = Array.from({ length: 7 }, (_, index) => ({
      attempts: index,
      available_at: '2026-06-21T10:00:00.000Z',
      created_at: `2026-06-21T10:0${index}:00.000Z`,
      id: `job-${index}`,
      job_type: 'work_order_received' as const,
      last_error: null,
      max_attempts: 3,
      payload: { secret: 'must-not-leak' },
      recipient_line_user_id: 'U-secret',
      sent_at: null,
      skip_reason: null,
      status: 'pending' as const,
    }));
    const response = mapAdminWorkOrderLineStatus(
      {
        binding: {
          blocked_at: null,
          display_name: '王小明',
          is_friend: true,
          last_seen_at: '2026-06-21T09:00:00.000Z',
          line_user_id: 'U-secret',
          linked_at: '2026-06-20T10:00:00.000Z',
        },
        customerId: CUSTOMER_ID,
        latestToken: {
          expires_at: '2026-07-21T10:00:00.000Z',
          id: TOKEN_ID,
          revoked_at: null,
          token_hash: 'hash-secret',
          used_at: '2026-06-21T10:00:00.000Z',
        },
        recentJobs,
        workOrderId: WORK_ORDER_ID,
      },
      new Date('2026-06-21T10:00:00.000Z'),
    );

    expect(response.data.binding).toEqual({
      blockedAt: null,
      displayName: '王小明',
      friendshipCheckedAt: '2026-06-21T09:00:00.000Z',
      linkedAt: '2026-06-20T10:00:00.000Z',
      notificationStatus: 'notifyable',
      status: 'bound',
    });
    expect(response.data.latestToken).toMatchObject({ status: 'used' });
    expect(response.data.recentJobs).toHaveLength(5);
    const serialized = JSON.stringify(response);
    for (const sensitiveValue of ['U-secret', 'hash-secret', 'must-not-leak']) {
      expect(serialized).not.toContain(sensitiveValue);
    }
  });

  it('maps unbound and no-token states explicitly', () => {
    const response = mapAdminWorkOrderLineStatus({
      binding: null,
      customerId: CUSTOMER_ID,
      latestToken: null,
      recentJobs: [],
      workOrderId: WORK_ORDER_ID,
    });

    expect(response.data.binding).toEqual({
      blockedAt: null,
      displayName: null,
      friendshipCheckedAt: null,
      linkedAt: null,
      notificationStatus: 'not_notifyable',
      status: 'unbound',
    });
    expect(response.data.latestToken).toEqual({ status: 'none' });
  });

  it.each([
    ['pending', { expires_at: '2026-07-21T10:00:00.000Z', revoked_at: null, used_at: null }],
    [
      'used',
      {
        expires_at: '2026-07-21T10:00:00.000Z',
        revoked_at: null,
        used_at: '2026-06-21T09:00:00.000Z',
      },
    ],
    ['expired', { expires_at: '2026-06-21T09:59:59.000Z', revoked_at: null, used_at: null }],
    [
      'revoked',
      {
        expires_at: '2026-07-21T10:00:00.000Z',
        revoked_at: '2026-06-21T09:00:00.000Z',
        used_at: null,
      },
    ],
  ] as const)('maps latest token state %s', (expected, tokenState) => {
    const response = mapAdminWorkOrderLineStatus(
      {
        binding: null,
        customerId: CUSTOMER_ID,
        latestToken: { id: TOKEN_ID, ...tokenState },
        recentJobs: [],
        workOrderId: WORK_ORDER_ID,
      },
      new Date('2026-06-21T10:00:00.000Z'),
    );

    expect(response.data.latestToken.status).toBe(expected);
  });
});
