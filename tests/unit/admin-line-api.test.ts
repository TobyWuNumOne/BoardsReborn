import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CustomerAlreadyBoundError,
  NoActiveLineBindingError,
  ValidationError,
} from '../../server/utils/api-errors';
import {
  deriveLineNotificationStatus,
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

  it('keeps all three routes admin-only and free of print integration', () => {
    const routePaths = [
      'server/api/admin/work-orders/[id]/line-bind-token.post.ts',
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
        liffUrl: expect.stringMatching(/^https:\/\/liff\.line\.me\/1234567890-test\?t=/),
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
