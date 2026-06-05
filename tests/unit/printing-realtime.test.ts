import { describe, expect, it } from 'vitest';
import { emitPrintJobChangedBestEffort } from '../../server/utils/printing-realtime';

describe('emitPrintJobChangedBestEffort', () => {
  it('emits worker wakeup before job and summary events when a wakeup reason is present', async () => {
    const calls: Array<{ args: Record<string, unknown>; name: string }> = [];
    const client = {
      rpc(name: string, args: Record<string, unknown>) {
        calls.push({ args, name });

        return Promise.resolve({
          data: null,
          error: null,
        });
      },
    };

    await emitPrintJobChangedBestEffort(client as never, {
      changedAt: '2026-06-05T00:00:00.000Z',
      entityId: 'job-1',
      jobStatus: 'pending',
      operation: 'INSERT',
      wakeupReason: 'enqueued',
      workOrderId: 'work-order-1',
    });

    expect(calls).toHaveLength(3);
    expect(calls[0]).toEqual({
      args: {
        p_event: 'printing.job_available',
        p_is_private: false,
        p_payload: {
          changedAt: '2026-06-05T00:00:00.000Z',
          eventType: 'printing.job_available',
          reason: 'enqueued',
        },
        p_topic: 'printing:worker-wakeup',
      },
      name: 'emit_printing_realtime_event',
    });
    expect(calls.slice(1)).toEqual(
      expect.arrayContaining([
        {
          args: {
            p_event: 'print_job.changed',
            p_is_private: true,
            p_payload: {
              changedAt: '2026-06-05T00:00:00.000Z',
              entityId: 'job-1',
              eventType: 'print_job.changed',
              jobStatus: 'pending',
              operation: 'INSERT',
              source: 'print_jobs',
              workOrderId: 'work-order-1',
            },
            p_topic: 'printing:jobs',
          },
          name: 'emit_printing_realtime_event',
        },
        {
          args: {
            p_event: 'printing.summary.changed',
            p_is_private: true,
            p_payload: {
              changedAt: '2026-06-05T00:00:00.000Z',
              entityId: 'job-1',
              eventType: 'printing.summary.changed',
              operation: 'INSERT',
              source: 'print_jobs',
              workOrderId: 'work-order-1',
            },
            p_topic: 'printing:summary',
          },
          name: 'emit_printing_realtime_event',
        },
      ]),
    );
  });
});
