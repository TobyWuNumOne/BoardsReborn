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
  createAdminPrintDevice,
  deleteAdminPrintDevice,
  listAdminPrintDevices,
  updateAdminPrintDevice,
} from '../../server/utils/print-devices';
import {
  parseClaimPrintJobBody,
  parseCreatePrintDeviceBody,
  parseCreatePrintJobBody,
  parseFailPrintJobBody,
  parsePrintDeviceListQuery,
  parsePrintJobListQuery,
  parseSucceedPrintJobBody,
  parseUpdatePrintDeviceBody,
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
        paperOrderNo: 'BR-2026-0001',
        sort: 'updatedAt:asc',
        status: 'failed',
        workOrderId: '4d4ff81c-2b1d-41aa-9fd2-7fd43fba4df2',
      }),
    ).toEqual({
      filters: {
        paperOrderNo: 'BR-2026-0001',
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

  it('parses strict print device list and update payloads', () => {
    expect(
      parsePrintDeviceListQuery({
        page: '2',
        pageSize: '50',
        q: 'front desk',
        sort: 'lastSeenAt:desc',
        status: 'active',
      }),
    ).toEqual({
      filters: {
        q: 'front desk',
        status: 'active',
      },
      page: 2,
      pageSize: 50,
      sort: {
        direction: 'desc',
        field: 'last_seen_at',
      },
    });

    expect(
      parseCreatePrintDeviceBody({
        deviceKey: 'raspi-print-worker-01',
        location: 'Front Desk',
        name: 'Front Desk Pi',
        status: 'active',
      }),
    ).toEqual({
      deviceKey: 'raspi-print-worker-01',
      location: 'Front Desk',
      name: 'Front Desk Pi',
      status: 'active',
    });

    expect(
      parseUpdatePrintDeviceBody({
        location: '',
        name: 'Front Desk Pi',
        status: 'inactive',
      }),
    ).toEqual({
      location: null,
      name: 'Front Desk Pi',
      status: 'inactive',
    });

    expectValidationField(() => parsePrintDeviceListQuery({ unknown: 'nope' }), 'unknown');
    expectValidationField(() => parseCreatePrintDeviceBody({ location: 'Front Desk' }), 'name');
    expectValidationField(() => parseUpdatePrintDeviceBody({ deviceKey: 'nope' }), 'deviceKey');
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
          emit_printing_realtime_event: null,
        };

        return Promise.resolve({
          data: dataByName[name],
          error: null,
        });
      },
      from(table: string) {
        if (table === 'admin_print_job_list') {
          return {
            eq() {
              return {
                maybeSingle() {
                  return Promise.resolve({
                    data: {
                      created_at: '2026-05-21T00:00:00.000Z',
                      id: 'job-1',
                      status: 'pending',
                      updated_at: '2026-05-21T00:03:00.000Z',
                      work_order_id: 'work-order-1',
                    },
                    error: null,
                  });
                },
              };
            },
            select() {
              return this;
            },
          };
        }

        if (table === 'print_devices') {
          return {
            eq() {
              return {
                maybeSingle() {
                  return Promise.resolve({
                    data: {
                      created_at: '2026-05-21T00:00:00.000Z',
                      device_key: 'raspi-print-worker-01',
                      id: 'device-1',
                      updated_at: '2026-05-21T00:03:00.000Z',
                    },
                    error: null,
                  });
                },
              };
            },
            select() {
              return this;
            },
          };
        }

        throw new Error(`Unexpected table ${table}`);
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

    expect(calls[0]).toEqual({
      args: {
        p_created_by_user_id: 'user-1',
        p_job_type: 'work_order_label',
        p_work_order_id: 'work-order-1',
      },
      name: 'create_admin_print_job',
    });
    expect(calls.map((call) => call.name)).toContain('claim_next_print_job');
    expect(calls.map((call) => call.name)).toContain('mark_print_job_succeeded');
    expect(calls.map((call) => call.name)).toContain('mark_print_job_failed');
    expect(calls.map((call) => call.name)).toContain('retry_admin_print_job');
    expect(calls.filter((call) => call.name === 'emit_printing_realtime_event')).toEqual(
      expect.arrayContaining([
        {
          args: {
            p_event: 'printing.job_available',
            p_is_private: false,
            p_payload: {
              changedAt: '2026-05-21T00:00:00.000Z',
              eventType: 'printing.job_available',
              reason: 'enqueued',
            },
            p_topic: 'printing:worker-wakeup',
          },
          name: 'emit_printing_realtime_event',
        },
        {
          args: {
            p_event: 'printing.job_available',
            p_is_private: false,
            p_payload: {
              changedAt: '2026-05-21T00:03:00.000Z',
              eventType: 'printing.job_available',
              reason: 'retried',
            },
            p_topic: 'printing:worker-wakeup',
          },
          name: 'emit_printing_realtime_event',
        },
      ]),
    );
  });

  it('creates, lists, updates, and deletes admin print devices with nested state', async () => {
    const calls: Array<{ payload?: Record<string, unknown>; type: string }> = [];
    const client = {
      rpc() {
        return Promise.resolve({
          data: null,
          error: null,
        });
      },
      from(table: string) {
        if (table === 'admin_print_device_list') {
          return {
            eq() {
              return this;
            },
            ilike() {
              return this;
            },
            maybeSingle() {
              calls.push({ type: 'get-device' });
              return Promise.resolve({
                data: {
                  created_at: '2026-05-21T08:00:00.000Z',
                  current_job_id: 'job-1',
                  current_job_locked_at: '2026-05-22T09:28:00.000Z',
                  current_job_paper_order_no: 'BR-2026-0001',
                  current_job_status: 'locked',
                  current_job_work_order_id: 'work-order-1',
                  device_key: 'raspi-print-worker-01',
                  id: 'device-1',
                  last_seen_at: '2026-05-22T09:30:00.000Z',
                  location: 'Front Desk',
                  name: 'Front Desk Pi',
                  recent_error_job_id: 'job-error-1',
                  recent_error_message: 'Printer offline',
                  recent_error_updated_at: '2026-05-22T08:12:00.000Z',
                  status: 'inactive',
                  updated_at: '2026-05-22T09:35:00.000Z',
                },
                error: null,
              });
            },
            order() {
              return this;
            },
            range() {
              calls.push({ type: 'list-devices' });
              return Promise.resolve({
                count: 1,
                data: [
                  {
                    created_at: '2026-05-21T08:00:00.000Z',
                    current_job_id: null,
                    current_job_locked_at: null,
                    current_job_paper_order_no: null,
                    current_job_status: null,
                    current_job_work_order_id: null,
                    device_key: 'raspi-print-worker-01',
                    id: 'device-1',
                    last_seen_at: '2026-05-22T09:30:00.000Z',
                    location: 'Front Desk',
                    name: 'Front Desk Pi',
                    recent_error_job_id: 'job-error-1',
                    recent_error_message: 'Printer offline',
                    recent_error_updated_at: '2026-05-22T08:12:00.000Z',
                    status: 'active',
                    updated_at: '2026-05-22T09:35:00.000Z',
                  },
                ],
                error: null,
              });
            },
            select() {
              return this;
            },
          };
        }

        if (table === 'print_devices') {
          return {
            delete() {
              calls.push({ type: 'delete-device' });
              return this;
            },
            eq() {
              return this;
            },
            maybeSingle() {
              const latestAction = calls.at(-1)?.type;

              if (latestAction === 'delete-device') {
                return Promise.resolve({
                  data: {
                    id: 'device-1',
                  },
                  error: null,
                });
              }

              calls.push({ type: 'update-select' });
              return Promise.resolve({
                data: {
                  id: 'device-1',
                },
                error: null,
              });
            },
            select() {
              return this;
            },
            insert(payload: Record<string, unknown>) {
              calls.push({ payload, type: 'create-device' });
              return this;
            },
            update(payload: Record<string, unknown>) {
              calls.push({ payload, type: 'update-device' });
              return this;
            },
          };
        }

        if (table === 'print_jobs') {
          return {
            eq() {
              return this;
            },
            in() {
              calls.push({ type: 'active-job-check' });
              return Promise.resolve({
                count: 0,
                data: null,
                error: null,
              });
            },
            select() {
              return this;
            },
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    };

    await expect(
      createAdminPrintDevice(client as never, {
        deviceKey: 'raspi-print-worker-01',
        location: 'Front Desk',
        name: 'Front Desk Pi',
        status: 'active',
      }),
    ).resolves.toEqual({
      data: {
        createdAt: '2026-05-21T08:00:00.000Z',
        currentJob: {
          id: 'job-1',
          lockedAt: '2026-05-22T09:28:00.000Z',
          paperOrderNo: 'BR-2026-0001',
          status: 'locked',
          workOrderId: 'work-order-1',
        },
        deviceKey: 'raspi-print-worker-01',
        id: 'device-1',
        lastSeenAt: '2026-05-22T09:30:00.000Z',
        location: 'Front Desk',
        name: 'Front Desk Pi',
        recentError: {
          jobId: 'job-error-1',
          message: 'Printer offline',
          updatedAt: '2026-05-22T08:12:00.000Z',
        },
        status: 'inactive',
        updatedAt: '2026-05-22T09:35:00.000Z',
      },
    });

    await expect(
      listAdminPrintDevices(client as never, {
        filters: {
          q: 'front desk',
          status: 'active',
        },
        page: 1,
        pageSize: 20,
        sort: {
          direction: 'desc',
          field: 'updated_at',
        },
      }),
    ).resolves.toEqual({
      data: [
        {
          createdAt: '2026-05-21T08:00:00.000Z',
          currentJob: null,
          deviceKey: 'raspi-print-worker-01',
          id: 'device-1',
          lastSeenAt: '2026-05-22T09:30:00.000Z',
          location: 'Front Desk',
          name: 'Front Desk Pi',
          recentError: {
            jobId: 'job-error-1',
            message: 'Printer offline',
            updatedAt: '2026-05-22T08:12:00.000Z',
          },
          status: 'active',
          updatedAt: '2026-05-22T09:35:00.000Z',
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

    await expect(
      updateAdminPrintDevice(client as never, 'device-1', {
        location: null,
        name: 'Front Desk Pi',
        status: 'inactive',
      }),
    ).resolves.toEqual({
      data: {
        createdAt: '2026-05-21T08:00:00.000Z',
        currentJob: {
          id: 'job-1',
          lockedAt: '2026-05-22T09:28:00.000Z',
          paperOrderNo: 'BR-2026-0001',
          status: 'locked',
          workOrderId: 'work-order-1',
        },
        deviceKey: 'raspi-print-worker-01',
        id: 'device-1',
        lastSeenAt: '2026-05-22T09:30:00.000Z',
        location: 'Front Desk',
        name: 'Front Desk Pi',
        recentError: {
          jobId: 'job-error-1',
          message: 'Printer offline',
          updatedAt: '2026-05-22T08:12:00.000Z',
        },
        status: 'inactive',
        updatedAt: '2026-05-22T09:35:00.000Z',
      },
    });

    expect(calls).toContainEqual({
      payload: {
        location: null,
        name: 'Front Desk Pi',
        status: 'inactive',
      },
      type: 'update-device',
    });

    await expect(deleteAdminPrintDevice(client as never, 'device-1')).resolves.toEqual({
      data: {
        id: 'device-1',
      },
    });

    expect(calls).toContainEqual({
      payload: {
        device_key: 'raspi-print-worker-01',
        location: 'Front Desk',
        name: 'Front Desk Pi',
        status: 'active',
      },
      type: 'create-device',
    });
    expect(calls.some((call) => call.type === 'active-job-check')).toBe(true);
    expect(calls.some((call) => call.type === 'delete-device')).toBe(true);
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
      'emit_printing_realtime_event',
      'emit_printing_realtime_event',
      'emit_printing_realtime_event',
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
