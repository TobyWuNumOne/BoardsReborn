import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { InternalUnauthorizedError } from '../../server/utils/api-errors';
import {
  classifyLinePushResult,
  processLineJobs,
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

describe('LINE job Flex message preparation', () => {
  it('freezes a Flex message from the repository template before sending', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const updates: unknown[] = [];
    const supabase = {
      from(table: string) {
        expect(table).toBe('line_jobs');
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle() {
                    return Promise.resolve({
                      data: {
                        job_type: 'work_order_received',
                        payload: { paperOrderNo: '880002' },
                        work_orders: null,
                      },
                      error: null,
                    });
                  },
                };
              },
            };
          },
          update(value: unknown) {
            updates.push(value);
            const chain = {
              eq: () => chain,
              error: null,
            };
            return chain;
          },
        };
      },
      rpc(name: string) {
        if (name === 'claim_line_jobs') {
          return Promise.resolve({ data: { jobs: [{ id: 'job-1' }] }, error: null });
        }
        if (name === 'prepare_line_job') {
          return Promise.resolve({
            data: {
              messages: [{ text: '維修工單已收件。工單：880002', type: 'text' }],
              outcome: 'ready',
              recipient: 'U123',
              retryKey: '11111111-1111-4111-8111-111111111111',
            },
            error: null,
          });
        }
        if (name === 'record_line_job_result') {
          return Promise.resolve({ data: { outcome: 'succeeded' }, error: null });
        }
        return Promise.resolve({ data: null, error: { message: `unexpected rpc ${name}` } });
      },
    };

    await expect(processLineJobs(supabase as never, 'channel-access-token')).resolves.toEqual({
      claimed: 1,
      failed: 0,
      retried: 0,
      skipped: 0,
      succeeded: 1,
    });

    expect(updates).toHaveLength(1);
    expect(JSON.stringify(updates[0])).toContain('"type":"flex"');
    expect(JSON.stringify(updates[0])).toContain('880002');
    expect(fetch).toHaveBeenCalledWith(
      'https://api.line.me/v2/bot/message/push',
      expect.objectContaining({
        body: expect.stringContaining('"type":"flex"'),
      }),
    );

    vi.unstubAllGlobals();
  });
});
