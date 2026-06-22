import { describe, expect, it } from 'vitest';
import { enqueueWorkOrderReceivedLineNotification } from '../../server/utils/work-order-line-notifications';

describe('work-order received LINE notification enqueue', () => {
  it('returns an enqueued job from the database transaction', async () => {
    const calls: Array<{ args: unknown; name: string }> = [];
    const client = {
      rpc(name: string, args: unknown) {
        calls.push({ args, name });
        return Promise.resolve({
          data: { enqueued: true, jobId: 'line-job-id' },
          error: null,
        });
      },
    };

    await expect(
      enqueueWorkOrderReceivedLineNotification(client as never, 'work-order-id'),
    ).resolves.toEqual({ enqueued: true, jobId: 'line-job-id' });
    expect(calls).toEqual([
      {
        args: { p_work_order_id: 'work-order-id' },
        name: 'enqueue_work_order_received_line_job',
      },
    ]);
  });

  it.each(['NO_ACTIVE_LINE_BINDING', 'JOB_ALREADY_EXISTS'] as const)(
    'preserves the non-error result %s',
    async (reason) => {
      const client = {
        rpc() {
          return Promise.resolve({ data: { enqueued: false, reason }, error: null });
        },
      };

      await expect(
        enqueueWorkOrderReceivedLineNotification(client as never, 'work-order-id'),
      ).resolves.toEqual({ enqueued: false, reason });
    },
  );

  it('turns database failures into an observable best-effort result', async () => {
    const client = {
      rpc() {
        return Promise.resolve({
          data: null,
          error: { code: 'XX000', message: 'insert failed' },
        });
      },
    };

    await expect(
      enqueueWorkOrderReceivedLineNotification(client as never, 'work-order-id'),
    ).resolves.toEqual({ enqueued: false, reason: 'ENQUEUE_FAILED' });
  });

  it('rejects malformed successful RPC payloads as enqueue failures', async () => {
    const client = {
      rpc() {
        return Promise.resolve({ data: { enqueued: true }, error: null });
      },
    };

    await expect(
      enqueueWorkOrderReceivedLineNotification(client as never, 'work-order-id'),
    ).resolves.toEqual({ enqueued: false, reason: 'ENQUEUE_FAILED' });
  });
});
