import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Database } from '../../types/database.types';
import type { ServiceRoleSupabaseClient } from './supabase-clients';
import { InternalServerError, LineWebhookSignatureInvalidError } from './api-errors';
import { throwMappedSupabaseError } from './supabase-errors';

interface LineWebhookEvent {
  source?: {
    type?: unknown;
    userId?: unknown;
  };
  type?: unknown;
}

export interface LineWebhookBody {
  events: LineWebhookEvent[];
}

interface FriendshipUpdate {
  blockedAt: string | null;
  checkedAt: string;
  isFriend: boolean;
  lineUserId: string;
}

const requireSecret = (secret: string) => {
  const value = secret.trim();
  if (!value) throw new InternalServerError('LINE webhook configuration is missing.');
  return value;
};

export const verifyLineWebhookSignature = (
  rawBody: Buffer,
  signature: string | undefined,
  channelSecret: string,
) => {
  const expected = createHmac('sha256', requireSecret(channelSecret)).update(rawBody).digest();
  let received: Buffer;

  try {
    received = Buffer.from(signature ?? '', 'base64');
  } catch {
    throw new LineWebhookSignatureInvalidError();
  }

  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new LineWebhookSignatureInvalidError();
  }
};

export const parseLineWebhookBody = (rawBody: Buffer): LineWebhookBody => {
  let value: unknown;
  try {
    value = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw new InternalServerError('LINE webhook body is invalid.');
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InternalServerError('LINE webhook body is invalid.');
  }
  const events = (value as { events?: unknown }).events;
  if (!Array.isArray(events)) throw new InternalServerError('LINE webhook events are invalid.');
  return { events: events as LineWebhookEvent[] };
};

export const updateLineFriendshipStatus = async (
  supabase: ServiceRoleSupabaseClient,
  input: FriendshipUpdate,
) => {
  const update: Database['public']['Tables']['customer_line_accounts']['Update'] = {
    blocked_at: input.blockedAt,
    friendship_checked_at: input.checkedAt,
    is_friend: input.isFriend,
  };
  const { error } = await supabase
    .from('customer_line_accounts')
    .update(update)
    .eq('line_user_id', input.lineUserId);
  if (error) throwMappedSupabaseError(error);
};

export const processLineWebhookEvents = async (
  body: LineWebhookBody,
  dependencies: {
    now?: () => Date;
    updateFriendship: (input: FriendshipUpdate) => Promise<void>;
  },
) => {
  for (const event of body.events) {
    if (event.type !== 'follow' && event.type !== 'unfollow') continue;
    if (event.source?.type !== 'user' || typeof event.source.userId !== 'string') continue;

    const checkedAt = (dependencies.now?.() ?? new Date()).toISOString();
    const isFriend = event.type === 'follow';
    await dependencies.updateFriendship({
      blockedAt: isFriend ? null : checkedAt,
      checkedAt,
      isFriend,
      lineUserId: event.source.userId,
    });
  }

  return { accepted: true as const };
};
