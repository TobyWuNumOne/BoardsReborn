import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { LineWebhookSignatureInvalidError } from '../../server/utils/api-errors';
import {
  parseLineWebhookBody,
  processLineWebhookEvents,
  updateLineFriendshipStatus,
  verifyLineWebhookSignature,
} from '../../server/utils/line-webhook';

const SECRET = 'messaging-channel-secret';
const FOLLOW_BODY = Buffer.from(
  '{\n  "destination": "bot",\n  "events": [{"type":"follow","source":{"type":"user","userId":"U123"}}]\n}',
);
const sign = (body: Buffer) => createHmac('sha256', SECRET).update(body).digest('base64');

describe('LINE webhook signature', () => {
  it('verifies the exact raw body bytes', () => {
    expect(verifyLineWebhookSignature(FOLLOW_BODY, sign(FOLLOW_BODY), SECRET)).toBeUndefined();
    const reparsed = Buffer.from(JSON.stringify(JSON.parse(FOLLOW_BODY.toString('utf8'))));
    expect(() => verifyLineWebhookSignature(reparsed, sign(FOLLOW_BODY), SECRET)).toThrow(
      LineWebhookSignatureInvalidError,
    );
  });

  it('rejects an invalid or missing signature', () => {
    expect(() => verifyLineWebhookSignature(FOLLOW_BODY, 'invalid', SECRET)).toThrow(
      LineWebhookSignatureInvalidError,
    );
    expect(() => verifyLineWebhookSignature(FOLLOW_BODY, '', SECRET)).toThrow(
      LineWebhookSignatureInvalidError,
    );
  });

  it('fails fast when the private channel secret is missing', () => {
    expect(() => verifyLineWebhookSignature(FOLLOW_BODY, sign(FOLLOW_BODY), '')).toThrow(
      'LINE webhook configuration is missing.',
    );
  });

  it('keeps route verification ahead of parsing and never uses readBody', () => {
    const route = readFileSync(resolve(process.cwd(), 'server/api/webhooks/line.post.ts'), 'utf8');
    expect(route).toContain('readRawBody(event, false)');
    expect(route).not.toContain('readBody(');
    expect(route.indexOf('verifyLineWebhookSignature')).toBeLessThan(
      route.indexOf('parseLineWebhookBody'),
    );
  });

  it('does not add webhook secret or identity logging', () => {
    const utility = readFileSync(resolve(process.cwd(), 'server/utils/line-webhook.ts'), 'utf8');
    expect(utility).not.toContain('console.');
    expect(utility).not.toContain('JSON.stringify');
  });
});

describe('LINE webhook event handling', () => {
  const now = new Date('2026-06-21T10:00:00.000Z');

  it('accepts an empty events array', async () => {
    const updateFriendship = vi.fn();
    await expect(
      processLineWebhookEvents(parseLineWebhookBody(Buffer.from('{"events":[]}')), {
        now: () => now,
        updateFriendship,
      }),
    ).resolves.toEqual({ accepted: true });
    expect(updateFriendship).not.toHaveBeenCalled();
  });

  it('updates follow and unfollow friendship state', async () => {
    const updateFriendship = vi.fn().mockResolvedValue(undefined);
    await processLineWebhookEvents(
      {
        events: [
          { source: { type: 'user', userId: 'U123' }, type: 'follow' },
          { source: { type: 'user', userId: 'U456' }, type: 'unfollow' },
        ],
      },
      { now: () => now, updateFriendship },
    );

    expect(updateFriendship).toHaveBeenNthCalledWith(1, {
      blockedAt: null,
      checkedAt: now.toISOString(),
      isFriend: true,
      lineUserId: 'U123',
    });
    expect(updateFriendship).toHaveBeenNthCalledWith(2, {
      blockedAt: now.toISOString(),
      checkedAt: now.toISOString(),
      isFriend: false,
      lineUserId: 'U456',
    });
  });

  it('ignores non-user, unknown and unrelated events', async () => {
    const updateFriendship = vi.fn();
    await expect(
      processLineWebhookEvents(
        {
          events: [
            { source: { type: 'group', groupId: 'G123' }, type: 'follow' },
            { source: { type: 'user' }, type: 'unfollow' },
            { source: { type: 'user', userId: 'U123' }, type: 'message' },
          ],
        },
        { now: () => now, updateFriendship },
      ),
    ).resolves.toEqual({ accepted: true });
    expect(updateFriendship).not.toHaveBeenCalled();
  });

  it('is idempotent for repeated follow and unfollow events', async () => {
    const states = new Map<string, { blockedAt: string | null; isFriend: boolean }>();
    const updateFriendship = vi.fn(async (input) => {
      states.set(input.lineUserId, { blockedAt: input.blockedAt, isFriend: input.isFriend });
    });
    const follow = { source: { type: 'user', userId: 'U123' }, type: 'follow' };
    const unfollow = { source: { type: 'user', userId: 'U123' }, type: 'unfollow' };

    await processLineWebhookEvents(
      { events: [follow, follow] },
      { now: () => now, updateFriendship },
    );
    expect(states.get('U123')).toEqual({ blockedAt: null, isFriend: true });
    await processLineWebhookEvents(
      { events: [unfollow, unfollow] },
      { now: () => now, updateFriendship },
    );
    expect(states.get('U123')).toEqual({ blockedAt: now.toISOString(), isFriend: false });
  });

  it('updates by line user ID and treats an unknown binding as success', async () => {
    const calls: unknown[] = [];
    const client = {
      from(table: string) {
        expect(table).toBe('customer_line_accounts');
        return {
          update(payload: unknown) {
            calls.push(payload);
            return this;
          },
          eq(column: string, value: string) {
            calls.push({ column, value });
            return Promise.resolve({ data: null, error: null });
          },
        };
      },
    };

    await expect(
      updateLineFriendshipStatus(client as never, {
        blockedAt: null,
        checkedAt: now.toISOString(),
        isFriend: true,
        lineUserId: 'U-unknown',
      }),
    ).resolves.toBeUndefined();
    expect(calls).toEqual([
      {
        blocked_at: null,
        friendship_checked_at: now.toISOString(),
        is_friend: true,
      },
      { column: 'line_user_id', value: 'U-unknown' },
    ]);
  });
});
