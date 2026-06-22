import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { InternalUnauthorizedError } from '../../server/utils/api-errors';
import {
  classifyLinePushResult,
  processLineJobBatch,
  requireLineJobProcessorSecret,
  sendLinePushMessage,
} from '../../server/utils/line-job-processor';

describe('LINE job processor auth', () => {
  it('accepts only the exact Bearer secret', () => {
    expect(() => requireLineJobProcessorSecret(undefined, 'processor-secret')).toThrow(
      InternalUnauthorizedError,
    );
    expect(() => requireLineJobProcessorSecret('Bearer wrong', 'processor-secret')).toThrow(
      InternalUnauthorizedError,
    );
    expect(() =>
      requireLineJobProcessorSecret('Bearer processor-secret', 'processor-secret'),
    ).not.toThrow();
  });

  it('fails fast on missing server configuration without logging secrets', () => {
    expect(() => requireLineJobProcessorSecret('Bearer any', '')).toThrow(
      'LINE job processor configuration is missing.',
    );
    const utility = readFileSync(
      resolve(process.cwd(), 'server/utils/line-job-processor.ts'),
      'utf8',
    );
    expect(utility).not.toContain('console.');
  });
});

describe('LINE Messaging API push', () => {
  it('sends the frozen recipient, messages and retry key without exposing them in results', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    await expect(
      sendLinePushMessage(
        {
          messages: [{ text: 'ready', type: 'text' }],
          recipient: 'U123',
          retryKey: '11111111-1111-4111-8111-111111111111',
        },
        'channel-access-token',
        fetch,
      ),
    ).resolves.toEqual({ kind: 'accepted' });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.line.me/v2/bot/message/push',
      expect.objectContaining({
        body: JSON.stringify({ messages: [{ text: 'ready', type: 'text' }], to: 'U123' }),
        headers: expect.objectContaining({
          Authorization: 'Bearer channel-access-token',
          'X-Line-Retry-Key': '11111111-1111-4111-8111-111111111111',
        }),
        method: 'POST',
      }),
    );
  });

  it.each([
    [200, {}, 'accepted'],
    [202, {}, 'accepted'],
    [409, { 'x-line-accepted-request-id': 'accepted-id' }, 'accepted'],
    [409, {}, 'failed'],
    [400, {}, 'failed'],
    [429, {}, 'retry'],
    [500, {}, 'retry'],
    [503, {}, 'retry'],
  ] as const)('classifies HTTP %s as %s', (status, headers, expected) => {
    expect(classifyLinePushResult(new Response('{}', { headers, status }))).toEqual({
      kind: expected,
    });
  });

  it('classifies timeout/network errors as retryable', async () => {
    await expect(
      sendLinePushMessage(
        {
          messages: [{ text: 'ready', type: 'text' }],
          recipient: 'U123',
          retryKey: '11111111-1111-4111-8111-111111111111',
        },
        'channel-access-token',
        vi.fn().mockRejectedValue(new Error('timeout')),
      ),
    ).resolves.toEqual({ kind: 'retry' });
  });
});

describe('LINE job batch isolation', () => {
  it('continues after one job fails and summarizes every outcome', async () => {
    const claimed = [{ id: 'job-1' }, { id: 'job-2' }, { id: 'job-3' }];
    const prepare = vi
      .fn()
      .mockResolvedValueOnce({ outcome: 'ready', messages: [], recipient: 'U1', retryKey: 'r1' })
      .mockResolvedValueOnce({ outcome: 'skipped' })
      .mockResolvedValueOnce({ outcome: 'ready', messages: [], recipient: 'U3', retryKey: 'r3' });
    const send = vi
      .fn()
      .mockResolvedValueOnce({ kind: 'accepted' })
      .mockResolvedValueOnce({ kind: 'failed' });
    const record = vi
      .fn()
      .mockResolvedValueOnce({ outcome: 'succeeded' })
      .mockResolvedValueOnce({ outcome: 'failed' });

    await expect(
      processLineJobBatch({
        claim: vi.fn().mockResolvedValue(claimed),
        prepare,
        record,
        send,
      }),
    ).resolves.toEqual({ claimed: 3, failed: 1, retried: 0, skipped: 1, succeeded: 1 });
  });
});
