import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';
import { InternalServerError, NotFoundError, ValidationError } from './api-errors';
import {
  deriveLineBindPlaintextToken,
  deriveLineBindTokenState,
  hashLineBindToken,
  rebuildLineBindLiffUrl,
  type LineBindTokenConfig,
} from './line-bind-tokens';
import { throwMappedSupabaseError } from './supabase-errors';

type AdminLineClient = SupabaseClient<Database>;

interface LineBindingStatusRow {
  blocked_at: string | null;
  display_name: string | null;
  friendship_checked_at?: string | null;
  is_friend: boolean;
  last_seen_at: string | null;
  line_user_id?: string;
  linked_at: string;
}

interface LineTokenStatusRow {
  expires_at: string;
  id: string;
  revoked_at: string | null;
  token_hash?: string;
  used_at: string | null;
}

interface LineJobStatusRow {
  attempts: number;
  available_at: string;
  created_at: string;
  id: string;
  job_type: Database['public']['Enums']['line_job_type'];
  last_error: string | null;
  max_attempts: number;
  payload?: unknown;
  recipient_line_user_id?: string | null;
  sent_at: string | null;
  skip_reason: Database['public']['Enums']['line_job_skip_reason'] | null;
  status: Database['public']['Enums']['line_job_status'];
}

interface AdminWorkOrderLineStatusInput {
  binding: LineBindingStatusRow | null;
  customerId: string;
  latestToken: LineTokenStatusRow | null;
  recentJobs: LineJobStatusRow[];
  workOrderId: string;
}

const assertRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InternalServerError();
  }

  return value as Record<string, unknown>;
};

const assertString = (value: unknown) => {
  if (typeof value !== 'string') {
    throw new InternalServerError();
  }

  return value;
};

const assertCount = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new InternalServerError();
  }

  return value;
};

export const parseAdminLineBindTokenBody = (body: unknown): Record<string, never> => {
  if (body === undefined || body === null) {
    return {};
  }

  if (typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError({ body: ['Must be an empty JSON object.'] });
  }

  const fields = Object.keys(body);

  if (fields.length > 0) {
    throw new ValidationError(
      Object.fromEntries(fields.map((field) => [field, ['Cannot be used by this endpoint.']])),
    );
  }

  return {};
};

export const deriveLineNotificationStatus = (
  binding: Pick<
    LineBindingStatusRow,
    'blocked_at' | 'friendship_checked_at' | 'is_friend' | 'last_seen_at'
  >,
) => {
  if (binding.is_friend && binding.blocked_at === null) {
    return 'notifyable' as const;
  }

  if (
    !binding.is_friend &&
    (binding.blocked_at !== null || binding.friendship_checked_at != null)
  ) {
    return 'not_notifyable' as const;
  }

  return 'unknown' as const;
};

export const issueAdminWorkOrderLineBindToken = async (
  supabase: AdminLineClient,
  workOrderId: string,
  userId: string,
  config: LineBindTokenConfig,
  tokenRowId = randomUUID(),
) => {
  const plaintextToken = deriveLineBindPlaintextToken(tokenRowId, config.lineBindTokenSecret);
  const { data, error } = await supabase.rpc('issue_admin_line_bind_token', {
    p_created_by: userId,
    p_token_hash: hashLineBindToken(plaintextToken),
    p_token_id: tokenRowId,
    p_work_order_id: workOrderId,
  });

  if (error) {
    throwMappedSupabaseError(error);
  }

  const result = assertRecord(data);
  const rebuilt = rebuildLineBindLiffUrl(tokenRowId, config);

  return {
    data: {
      expiresAt: assertString(result.expiresAt),
      id: assertString(result.id),
      liffUrl: rebuilt.url,
      revokedTokenCount: assertCount(result.revokedTokenCount),
    },
  };
};

export const issueAdminCustomerLineBindToken = async (
  supabase: AdminLineClient,
  {
    customerId,
    userId,
  }: {
    customerId: string;
    userId: string;
  },
  config: LineBindTokenConfig,
  tokenRowId = randomUUID(),
) => {
  const { data: workOrder, error } = await supabase
    .from('work_orders')
    .select('id')
    .eq('customer_id', customerId)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throwMappedSupabaseError(error);
  }

  if (!workOrder?.id) {
    throw new NotFoundError('Customer has no work orders for LINE binding.');
  }

  return issueAdminWorkOrderLineBindToken(supabase, workOrder.id, userId, config, tokenRowId);
};

export const unlinkAdminCustomerLineBinding = async (
  supabase: AdminLineClient,
  customerId: string,
) => {
  const { data, error } = await supabase.rpc('unlink_admin_customer_line_binding', {
    p_customer_id: customerId,
  });

  if (error) {
    throwMappedSupabaseError(error);
  }

  const result = assertRecord(data);
  return {
    data: {
      customerId: assertString(result.customerId),
      revokedTokenCount: assertCount(result.revokedTokenCount),
      skippedPendingJobCount: assertCount(result.skippedPendingJobCount),
      unlinkedAt: assertString(result.unlinkedAt),
    },
  };
};

export const mapAdminWorkOrderLineStatus = (
  input: AdminWorkOrderLineStatusInput,
  now = new Date(),
) => ({
  data: {
    binding: input.binding
      ? {
          blockedAt: input.binding.blocked_at,
          displayName: input.binding.display_name,
          friendshipCheckedAt: input.binding.friendship_checked_at ?? input.binding.last_seen_at,
          linkedAt: input.binding.linked_at,
          notificationStatus: deriveLineNotificationStatus(input.binding),
          status: 'bound' as const,
        }
      : {
          blockedAt: null,
          displayName: null,
          friendshipCheckedAt: null,
          linkedAt: null,
          notificationStatus: 'not_notifyable' as const,
          status: 'unbound' as const,
        },
    customerId: input.customerId,
    latestToken: input.latestToken
      ? {
          expiresAt: input.latestToken.expires_at,
          id: input.latestToken.id,
          revokedAt: input.latestToken.revoked_at,
          status: deriveLineBindTokenState(input.latestToken, now),
          usedAt: input.latestToken.used_at,
        }
      : { status: 'none' as const },
    recentJobs: input.recentJobs.slice(0, 5).map((job) => ({
      attempts: job.attempts,
      availableAt: job.available_at,
      createdAt: job.created_at,
      id: job.id,
      jobType: job.job_type,
      lastError: job.last_error,
      maxAttempts: job.max_attempts,
      sentAt: job.sent_at,
      skipReason: job.skip_reason,
      status: job.status,
    })),
    workOrderId: input.workOrderId,
  },
});

export const getAdminWorkOrderLineStatus = async (
  supabase: AdminLineClient,
  workOrderId: string,
) => {
  const { data: workOrder, error: workOrderError } = await supabase
    .from('work_orders')
    .select('id, customer_id')
    .eq('id', workOrderId)
    .maybeSingle();

  if (workOrderError) {
    throwMappedSupabaseError(workOrderError);
  }

  if (!workOrder) {
    throw new NotFoundError('Work order not found.');
  }

  const [bindingResult, tokenResult, jobsResult] = await Promise.all([
    supabase
      .from('customer_line_accounts')
      .select('display_name, linked_at, last_seen_at, friendship_checked_at, is_friend, blocked_at')
      .eq('customer_id', workOrder.customer_id)
      .maybeSingle(),
    supabase
      .from('line_bind_tokens')
      .select('id, expires_at, used_at, revoked_at')
      .eq('customer_id', workOrder.customer_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('line_jobs')
      .select(
        'id, job_type, status, attempts, max_attempts, available_at, skip_reason, last_error, sent_at, created_at',
      )
      .eq('customer_id', workOrder.customer_id)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  for (const error of [bindingResult.error, tokenResult.error, jobsResult.error]) {
    if (error) {
      throwMappedSupabaseError(error);
    }
  }

  return mapAdminWorkOrderLineStatus({
    binding: bindingResult.data,
    customerId: workOrder.customer_id,
    latestToken: tokenResult.data,
    recentJobs: jobsResult.data ?? [],
    workOrderId: workOrder.id,
  });
};
