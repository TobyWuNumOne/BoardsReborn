import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  claimPrintJob,
  createAdminPrintJob,
  listAdminPrintJobs,
  markPrintJobFailed,
  markPrintJobSucceeded,
  retryAdminPrintJob,
} from '../../server/utils/print-jobs';
import {
  parseClaimPrintJobBody,
  parseCreatePrintJobBody,
  parseFailPrintJobBody,
  parsePrintJobListQuery,
  parseSucceedPrintJobBody,
} from '../../server/utils/print-job-validation';
import { createAdminWorkOrder } from '../../server/utils/work-orders';
import { ValidationError } from '../../server/utils/api-errors';

const expectValidationField = (action: () => unknown, field: string) => {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).fieldErrors).toHaveProperty(field);
    return;
  }

  throw new Error('Expected ValidationError');
};

describe('print job validation', () => {
  it('parses strict admin print job list query values', () => {
    expect(
      parsePrintJobListQuery({
        page: '2',
        pageSize: '10',
        sort: 'updatedAt:asc',
        status: 'failed',
        workOrderId: '4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2',
      }),
    ).toEqual({
      filters: {
        status: 'failed',
        workOrderId: '4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2',
      },
      page: 2,
      pageSize: 10,
      sort: {
        direction: 'asc',
        field: 'updated_at',
      },
    });

    expectValidationField(
      () => parsePrintJobListQuery({ status: 'failed', unknown: 'nope' }),
      'unknown',
    );
    expectValidationField(() => parsePrintJobListQuery({ sort: 'status:desc' }), 'sort');
  });

  it('parses strict admin create and worker bodies', () => {
    expect(
      parseCreatePrintJobBody({
        jobType: 'work_order_label',
        workOrderId: '4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2',
      }),
    ).toEqual({
      jobType: 'work_order_label',
      workOrderId: '4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2',
    });

    expect(parseClaimPrintJobBody({ deviceKey: 'raspi-print-worker-01' })).toEqual({
      deviceKey: 'raspi-print-worker-01',
    });
    expect(parseSucceedPrintJobBody({ deviceKey: 'raspi-print-worker-01' })).toEqual({
      deviceKey: 'raspi-print-worker-01',
    });
    expect(
      parseFailPrintJobBody({
        deviceKey: 'raspi-print-worker-01',
        error: 'Printer offline',
      }),
    ).toEqual({
      deviceKey: 'raspi-print-worker-01',
      error: 'Printer offline',
    });

    expectValidationField(() => parseCreatePrintJobBody({ workOrderId: 'bad' }), 'workOrderId');
    expectValidationField(() => parseClaimPrintJobBody({}), 'deviceKey');
    expectValidationField(() => parseFailPrintJobBody({ deviceKey: 'pi', extra: true }), 'extra');
  });
});

describe('print job services', () => {
  it('lists admin print jobs with pagination and nested response mapping', async () => {
    const client = {
      from() {
        return {
          eq() {
            return this;
          },
          order() {
            return this;
          },
          range() {
            return Promise.resolve({
              count: 1,
              data: [
                {
                  attempt_count: 1,
                  board_length_class: 'SHORTBOARD',
                  board_type: 'SURFBOARD',
                  created_at: '2026-05-21T00:00:00.000Z',
                  customer_name: '王小明',
                  id: 'job-1',
                  job_type: 'work_order_label',
                  last_error: null,
                  locked_at: '2026-05-21T00:01:00.000Z',
                  locked_by: 'raspi-print-worker-01',
                  max_attempts: 3,
                  paper_order_no: 'BR-2026-0001',
                  print_device_id: 'device-1',
                  print_device_name: 'Front Desk Pi',
                  printed_at: null,
                  status: 'locked',
                  updated_at: '2026-05-21T00:01:00.000Z',
                  work_order_id: 'work-order-1',
                },
              ],
              error: null,
            });
          },
          select() {
            return this;
          },
        };
      },
    };

    await expect(
      listAdminPrintJobs(client as never, {
        filters: {
          status: 'locked',
          workOrderId: 'work-order-1',
        },
        page: 1,
        pageSize: 20,
        sort: {
          direction: 'desc',
          field: 'created_at',
        },
      }),
    ).resolves.toEqual({
      data: [
        {
          attemptCount: 1,
          board: {
            boardLengthClass: 'SHORTBOARD',
            boardType: 'SURFBOARD',
          },
          createdAt: '2026-05-21T00:00:00.000Z',
          customer: {
            name: '王小明',
          },
          device: {
            id: 'device-1',
            name: 'Front Desk Pi',
          },
          id: 'job-1',
          jobType: 'work_order_label',
          lastError: null,
          lockedAt: '2026-05-21T00:01:00.000Z',
          lockedBy: 'raspi-print-worker-01',
          maxAttempts: 3,
          printedAt: null,
          status: 'locked',
          updatedAt: '2026-05-21T00:01:00.000Z',
          workOrder: {
            id: 'work-order-1',
            paperOrderNo: 'BR-2026-0001',
          },
        },
      ],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      },
    });
  });

  it('calls admin and worker print job RPCs with the expected payloads', async () => {
    const calls: Array<{ args: Record<string, unknown>; name: string }> = [];
    const client = {
      rpc(name: string, args: Record<string, unknown>) {
        calls.push({ args, name });

        const dataByName: Record<string, unknown> = {
          claim_next_print_job: {
            job: {
              attemptCount: 0,
              createdAt: '2026-05-21T00:00:00.000Z',
              id: 'job-1',
              jobType: 'work_order_label',
              lockedAt: '2026-05-21T00:01:00.000Z',
              maxAttempts: 3,
              payload: {
                paperOrderNo: 'BR-2026-0001',
              },
              workOrderId: 'work-order-1',
            },
          },
          create_admin_print_job: {
            attemptCount: 0,
            createdAt: '2026-05-21T00:00:00.000Z',
            id: 'job-1',
            jobType: 'work_order_label',
            maxAttempts: 3,
            status: 'pending',
            updatedAt: '2026-05-21T00:00:00.000Z',
            workOrderId: 'work-order-1',
          },
          mark_print_job_failed: {
            attemptCount: 1,
            id: 'job-1',
            lastError: 'Printer offline',
            maxAttempts: 3,
            status: 'pending',
            updatedAt: '2026-05-21T00:02:00.000Z',
          },
          mark_print_job_succeeded: {
            attemptCount: 0,
            id: 'job-1',
            printedAt: '2026-05-21T00:02:00.000Z',
            status: 'printed',
            updatedAt: '2026-05-21T00:02:00.000Z',
          },
          retry_admin_print_job: {
            attemptCount: 2,
            id: 'job-1',
            jobType: 'work_order_label',
            maxAttempts: 3,
            status: 'pending',
            updatedAt: '2026-05-21T00:03:00.000Z',
            workOrderId: 'work-order-1',
          },
        };

        return Promise.resolve({
          data: dataByName[name],
          error: null,
        });
      },
    };

    await expect(
      createAdminPrintJob(
        client as never,
        {
          jobType: 'work_order_label',
          workOrderId: 'work-order-1',
        },
        'user-1',
      ),
    ).resolves.toEqual({
      data: {
        attemptCount: 0,
        createdAt: '2026-05-21T00:00:00.000Z',
        id: 'job-1',
        jobType: 'work_order_label',
        maxAttempts: 3,
        status: 'pending',
        updatedAt: '2026-05-21T00:00:00.000Z',
        workOrderId: 'work-order-1',
      },
    });

    await claimPrintJob(client as never, { deviceKey: 'raspi-print-worker-01' });
    await markPrintJobSucceeded(client as never, 'job-1', 'raspi-print-worker-01');
    await markPrintJobFailed(client as never, 'job-1', {
      deviceKey: 'raspi-print-worker-01',
      error: 'Printer offline',
    });
    await retryAdminPrintJob(client as never, 'job-1', 'user-1');

    expect(calls).toEqual([
      {
        args: {
          p_created_by_user_id: 'user-1',
          p_job_type: 'work_order_label',
          p_work_order_id: 'work-order-1',
        },
        name: 'create_admin_print_job',
      },
      {
        args: {
          p_device_key: 'raspi-print-worker-01',
          p_stale_lock_seconds: 300,
        },
        name: 'claim_next_print_job',
      },
      {
        args: {
          p_device_key: 'raspi-print-worker-01',
          p_print_job_id: 'job-1',
        },
        name: 'mark_print_job_succeeded',
      },
      {
        args: {
          p_device_key: 'raspi-print-worker-01',
          p_error: 'Printer offline',
          p_print_job_id: 'job-1',
        },
        name: 'mark_print_job_failed',
      },
      {
        args: {
          p_print_job_id: 'job-1',
          p_requested_by_user_id: 'user-1',
        },
        name: 'retry_admin_print_job',
      },
    ]);
  });
});

describe('work order print job enqueue', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('best-effort enqueues the initial print job after work order creation', async () => {
    const calls: Array<{ args: Record<string, unknown>; name: string }> = [];
    const client = {
      rpc(name: string, args: Record<string, unknown>) {
        calls.push({ args, name });

        if (name === 'create_admin_work_order') {
          return Promise.resolve({
            data: {
              createdAt: '2026-05-21T00:00:00.000Z',
              currentStatus: 'RECEIVED',
              id: 'work-order-1',
              paperOrderNo: 'BR-2026-0001',
              quoteTotalAmount: 0,
            },
            error: null,
          });
        }

        return Promise.resolve({
          data: {
            attemptCount: 0,
            createdAt: '2026-05-21T00:00:01.000Z',
            id: 'print-job-1',
            jobType: 'work_order_label',
            maxAttempts: 3,
            status: 'pending',
            updatedAt: '2026-05-21T00:00:01.000Z',
            workOrderId: 'work-order-1',
          },
          error: null,
        });
      },
    };

    await expect(
      createAdminWorkOrder(
        client as never,
        {
          board: {
            boardLengthClass: 'SHORTBOARD',
            boardType: 'SURFBOARD',
          },
          customer: {
            name: '王小明',
            phone: '0912345678',
          },
          customerMode: 'create',
          quoteItems: [],
          workOrder: {
            intakeDate: '2026-05-21',
            paperOrderNo: 'BR-2026-0001',
            paymentReceived: false,
          },
        },
        'user-1',
      ),
    ).resolves.toEqual({
      data: {
        createdAt: '2026-05-21T00:00:00.000Z',
        currentStatus: 'RECEIVED',
        id: 'work-order-1',
        paperOrderNo: 'BR-2026-0001',
        quoteTotalAmount: 0,
      },
    });

    expect(calls.map((call) => call.name)).toEqual([
      'create_admin_work_order',
      'create_admin_print_job',
    ]);
  });

  it('does not fail work order creation when initial print job enqueue fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = {
      rpc(name: string) {
        if (name === 'create_admin_work_order') {
          return Promise.resolve({
            data: {
              createdAt: '2026-05-21T00:00:00.000Z',
              currentStatus: 'RECEIVED',
              id: 'work-order-1',
              paperOrderNo: 'BR-2026-0001',
              quoteTotalAmount: 0,
            },
            error: null,
          });
        }

        return Promise.resolve({
          data: null,
          error: {
            code: '23505',
            message: 'duplicate key value violates unique constraint',
          },
        });
      },
    };

    await expect(
      createAdminWorkOrder(
        client as never,
        {
          board: {
            boardLengthClass: 'SHORTBOARD',
            boardType: 'SURFBOARD',
          },
          customer: {
            name: '王小明',
            phone: '0912345678',
          },
          customerMode: 'create',
          quoteItems: [],
          workOrder: {
            intakeDate: '2026-05-21',
            paperOrderNo: 'BR-2026-0001',
            paymentReceived: false,
          },
        },
        'user-1',
      ),
    ).resolves.toEqual({
      data: {
        createdAt: '2026-05-21T00:00:00.000Z',
        currentStatus: 'RECEIVED',
        id: 'work-order-1',
        paperOrderNo: 'BR-2026-0001',
        quoteTotalAmount: 0,
      },
    });

    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});
