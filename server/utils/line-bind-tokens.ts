import { createHash, createHmac, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';
import { InternalServerError } from './api-errors';
import { throwMappedSupabaseError } from './supabase-errors';

type LineBindTokenRow = Database['public']['Tables']['line_bind_tokens']['Row'];
type LineBindTokenClient = SupabaseClient<Database>;

export type LineBindTokenState = 'pending' | 'used' | 'expired' | 'revoked' | 'invalid';

export interface LineBindTokenConfig {
  liffId: string;
  lineBindTokenSecret: string;
}

interface LineBindTokenStateRow {
  expires_at: string;
  revoked_at: string | null;
  used_at: string | null;
}

interface IssueLineBindTokenInput {
  createdBy?: string | null;
  customerId: string;
  workOrderId: string;
}

const assertNonEmpty = (value: string | undefined | null) => {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new InternalServerError('LINE bind token configuration is missing.');
  }

  return trimmed;
};

const assertLineBindTokenRow = (value: unknown): LineBindTokenRow => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    typeof value.id !== 'string' ||
    !('token_hash' in value) ||
    typeof value.token_hash !== 'string' ||
    !('created_at' in value) ||
    typeof value.created_at !== 'string' ||
    !('expires_at' in value) ||
    typeof value.expires_at !== 'string'
  ) {
    throw new InternalServerError();
  }

  return value as LineBindTokenRow;
};

export const resolveLineBindTokenConfig = ({
  liffId,
  lineBindTokenSecret,
}: LineBindTokenConfig): LineBindTokenConfig => ({
  liffId: assertNonEmpty(liffId),
  lineBindTokenSecret: assertNonEmpty(lineBindTokenSecret),
});

export const deriveLineBindPlaintextToken = (tokenRowId: string, secret: string) =>
  createHmac('sha256', assertNonEmpty(secret))
    .update(assertNonEmpty(tokenRowId))
    .digest('base64url');

export const hashLineBindToken = (plaintextToken: string) =>
  createHash('sha256').update(assertNonEmpty(plaintextToken)).digest('hex');

export const buildLineBindLiffUrl = (liffId: string, plaintextToken: string) => {
  const url = new URL(
    `https://liff.line.me/${encodeURIComponent(assertNonEmpty(liffId))}/t/${encodeURIComponent(
      assertNonEmpty(plaintextToken),
    )}`,
  );
  return url.toString();
};

export const rebuildLineBindLiffUrl = (tokenRowId: string, config: LineBindTokenConfig) => {
  const resolvedConfig = resolveLineBindTokenConfig(config);
  const plaintextToken = deriveLineBindPlaintextToken(
    tokenRowId,
    resolvedConfig.lineBindTokenSecret,
  );

  return {
    plaintextToken,
    url: buildLineBindLiffUrl(resolvedConfig.liffId, plaintextToken),
  };
};

export const deriveLineBindTokenState = (
  row: LineBindTokenStateRow,
  now = new Date(),
): Exclude<LineBindTokenState, 'invalid'> => {
  if (row.revoked_at !== null) {
    return 'revoked';
  }

  if (row.used_at !== null) {
    return 'used';
  }

  if (new Date(row.expires_at).getTime() <= now.getTime()) {
    return 'expired';
  }

  return 'pending';
};

export const issueLineBindToken = async (
  supabase: LineBindTokenClient,
  input: IssueLineBindTokenInput,
  config: LineBindTokenConfig,
  tokenRowId = randomUUID(),
) => {
  const { plaintextToken, url } = rebuildLineBindLiffUrl(tokenRowId, config);
  const { data, error } = await supabase.rpc('issue_line_bind_token', {
    p_created_by: input.createdBy ?? undefined,
    p_customer_id: input.customerId,
    p_token_hash: hashLineBindToken(plaintextToken),
    p_token_id: tokenRowId,
    p_work_order_id: input.workOrderId,
  });

  if (error) {
    throwMappedSupabaseError(error);
  }

  return {
    plaintextToken,
    row: assertLineBindTokenRow(data),
    url,
  };
};

export const resolveLineBindToken = async (
  supabase: LineBindTokenClient,
  plaintextToken: string,
  now = new Date(),
): Promise<{ row: LineBindTokenRow | null; state: LineBindTokenState }> => {
  const { data, error } = await supabase
    .from('line_bind_tokens')
    .select('*')
    .eq('token_hash', hashLineBindToken(plaintextToken))
    .maybeSingle();

  if (error) {
    throwMappedSupabaseError(error);
  }

  if (!data) {
    return { row: null, state: 'invalid' };
  }

  const row = assertLineBindTokenRow(data);
  return { row, state: deriveLineBindTokenState(row, now) };
};

export const revokePendingLineBindTokens = async (
  supabase: LineBindTokenClient,
  customerId: string,
) => {
  const { data, error } = await supabase.rpc('revoke_pending_line_bind_tokens', {
    p_customer_id: customerId,
  });

  if (error) {
    throwMappedSupabaseError(error);
  }

  if (typeof data !== 'number') {
    throw new InternalServerError();
  }

  return data;
};
