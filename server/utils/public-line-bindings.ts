import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';
import {
  CustomerAlreadyBoundToOtherLineError,
  InternalServerError,
  LineAlreadyBoundToOtherCustomerError,
  TokenExpiredError,
  TokenInvalidError,
  TokenRevokedError,
  TokenUsedError,
  ValidationError,
} from './api-errors';
import { hashLineBindToken, resolveLineBindToken } from './line-bind-tokens';
import type { verifyLineIdentity as verifyLineIdentityFunction } from './line-platform';
import { throwMappedSupabaseError } from './supabase-errors';

type PublicLineClient = SupabaseClient<Database>;
type LineIdentity = Awaited<ReturnType<typeof verifyLineIdentityFunction>>;

const parseRecord = (value: unknown) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError({ body: ['Must be a JSON object.'] });
  }
  return value as Record<string, unknown>;
};

const requiredString = (value: unknown, field: string) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError({ [field]: ['Is required.'] });
  }
  return value.trim();
};

const rejectUnknown = (body: Record<string, unknown>, allowed: readonly string[]) => {
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length) {
    throw new ValidationError(
      Object.fromEntries(unknown.map((key) => [key, ['Cannot be used by this endpoint.']])),
    );
  }
};

export const parsePublicLineBindResolveBody = (value: unknown) => {
  const body = parseRecord(value);
  rejectUnknown(body, ['token']);
  return { token: requiredString(body.token, 'token') };
};

export const parsePublicLineBindConfirmBody = (value: unknown) => {
  const body = parseRecord(value);
  rejectUnknown(body, ['token', 'idToken', 'accessToken']);
  const accessToken =
    body.accessToken === undefined ? undefined : requiredString(body.accessToken, 'accessToken');
  return {
    ...(accessToken ? { accessToken } : {}),
    idToken: requiredString(body.idToken, 'idToken'),
    token: requiredString(body.token, 'token'),
  };
};

export const mapPublicLineBindResolve = (
  input: {
    bindingExists: boolean;
    boardType: Database['public']['Enums']['board_type'];
    expiresAt: string;
    paperOrderNo: string;
    tokenState: 'pending' | 'used' | 'expired' | 'revoked';
  } | null,
) => {
  if (!input) throw new TokenInvalidError();
  return {
    data: {
      bindingState: input.bindingExists ? ('bound' as const) : ('unbound' as const),
      canBind: input.tokenState === 'pending' && !input.bindingExists,
      expiresAt: input.expiresAt,
      tokenState: input.tokenState,
      workOrder: { boardType: input.boardType, paperOrderNo: input.paperOrderNo },
    },
  };
};

export const resolvePublicLineBinding = async (supabase: PublicLineClient, token: string) => {
  const resolved = await resolveLineBindToken(supabase, token);
  if (!resolved.row || resolved.state === 'invalid') throw new TokenInvalidError();

  const [{ data: workOrder, error: workOrderError }, { data: binding, error: bindingError }] =
    await Promise.all([
      supabase
        .from('work_orders')
        .select('paper_order_no, board_type')
        .eq('id', resolved.row.work_order_id)
        .single(),
      supabase
        .from('customer_line_accounts')
        .select('id')
        .eq('customer_id', resolved.row.customer_id)
        .maybeSingle(),
    ]);
  if (workOrderError) throwMappedSupabaseError(workOrderError);
  if (bindingError) throwMappedSupabaseError(bindingError);
  if (!workOrder) throw new TokenInvalidError();

  return mapPublicLineBindResolve({
    bindingExists: Boolean(binding),
    boardType: workOrder.board_type,
    expiresAt: resolved.row.expires_at,
    paperOrderNo: workOrder.paper_order_no,
    tokenState: resolved.state,
  });
};

interface ConfirmDependencies {
  officialLineUrl: string;
  verifyLineIdentity: (input: { accessToken?: string; idToken: string }) => Promise<LineIdentity>;
}

const sanitizeDiagnosticValue = (value: unknown, redactions: string[]) => {
  if (typeof value !== 'string' || value.trim() === '') return undefined;

  let sanitized = value;
  for (const redaction of redactions) {
    if (redaction) sanitized = sanitized.split(redaction).join('[redacted]');
  }

  return sanitized.replace(/\bU[0-9a-f]{20,}\b/gi, '[redacted-line-user]').slice(0, 500);
};

const reportLineConfirmRpcError = (
  error: unknown,
  redactions: { lineUserId: string; plaintextToken: string; tokenHash: string },
) => {
  const supabaseError = error as {
    code?: unknown;
    details?: unknown;
    hint?: unknown;
    message?: unknown;
  };
  const valuesToRedact = [
    redactions.plaintextToken,
    redactions.tokenHash,
    redactions.lineUserId,
  ].filter(Boolean);

  console.error('LINE binding confirm RPC failed', {
    code: sanitizeDiagnosticValue(supabaseError.code, valuesToRedact),
    details: sanitizeDiagnosticValue(supabaseError.details, valuesToRedact),
    hint: sanitizeDiagnosticValue(supabaseError.hint, valuesToRedact),
    message: sanitizeDiagnosticValue(supabaseError.message, valuesToRedact),
  });
};

const assertResult = (value: unknown) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InternalServerError();
  }
  return value as Record<string, unknown>;
};

export const confirmPublicLineBinding = async (
  supabase: PublicLineClient,
  input: { accessToken?: string; idToken: string; token: string },
  dependencies: ConfirmDependencies,
) => {
  const identity = await dependencies.verifyLineIdentity({
    ...(input.accessToken ? { accessToken: input.accessToken } : {}),
    idToken: input.idToken,
  });
  const tokenHash = hashLineBindToken(input.token);
  const { data, error } = await supabase.rpc('confirm_public_line_binding', {
    p_display_name: identity.displayName ?? undefined,
    p_friendship_checked: identity.friendship !== 'unknown',
    p_is_friend: identity.friendship === 'friend',
    p_line_user_id: identity.lineUserId,
    p_picture_url: identity.pictureUrl ?? undefined,
    p_token_hash: tokenHash,
  });
  if (error) {
    reportLineConfirmRpcError(error, {
      lineUserId: identity.lineUserId,
      plaintextToken: input.token,
      tokenHash,
    });
    throwMappedSupabaseError(error);
  }
  const result = assertResult(data);

  switch (result.outcome) {
    case 'token_invalid':
      throw new TokenInvalidError();
    case 'token_expired':
      throw new TokenExpiredError();
    case 'token_used':
      throw new TokenUsedError();
    case 'token_revoked':
      throw new TokenRevokedError();
    case 'line_conflict':
      throw new LineAlreadyBoundToOtherCustomerError();
    case 'customer_conflict':
      throw new CustomerAlreadyBoundToOtherLineError();
  }

  if (result.outcome !== 'linked' && result.outcome !== 'already_linked') {
    throw new InternalServerError();
  }

  return {
    data: {
      binding: {
        linkedAt: String(result.linkedAt),
        notificationStatus: String(result.notificationStatus),
      },
      next: {
        officialLineUrl: dependencies.officialLineUrl,
        repairStatusUrl: '/repair-status',
      },
      outcome: result.outcome,
      token: { usedAt: String(result.usedAt) },
      workOrder: { paperOrderNo: String(result.paperOrderNo) },
    },
  };
};
