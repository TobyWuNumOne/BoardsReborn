import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiContract = readFileSync(resolve(process.cwd(), 'docs/api-contract.md'), 'utf8');

describe('API contract', () => {
  it('documents the admin session flow, print queue APIs, and keeps UUID work-order endpoints explicit', () => {
    expect(apiContract).toContain('GET /api/admin/dashboard');
    expect(apiContract).toContain('activeWorkOrdersByStatus');
    expect(apiContract).toContain('activeWorkOrdersByStatus.RECEIVED + DRYING + REPAIRING');
    expect(apiContract).toContain('GET /api/admin/session');
    expect(apiContract).toContain('這支 endpoint 只回傳最小必要欄位');
    expect(apiContract).toContain('GET /api/admin/work-orders/resolve');
    expect(apiContract).toContain('paperOrderNo=260001');
    expect(apiContract).toContain('GET /api/admin/work-orders/{id}');
    expect(apiContract).toContain('PATCH /api/admin/work-orders/{id}');
    expect(apiContract).toContain('POST /api/admin/work-orders/{id}/status');
    expect(apiContract).toContain('GET /api/admin/print-jobs');
    expect(apiContract).toContain('POST /api/admin/print-jobs');
    expect(apiContract).toContain('POST /api/admin/print-jobs/{id}/retry');
    expect(apiContract).toContain('GET /api/admin/print-summaries');
    expect(apiContract).toContain('GET /api/admin/print-devices');
    expect(apiContract).toContain('POST /api/admin/print-devices');
    expect(apiContract).toContain('PATCH /api/admin/print-devices/{id}');
    expect(apiContract).toContain('DELETE /api/admin/print-devices/{id}');
    expect(apiContract).toContain('printing:jobs');
    expect(apiContract).toContain('printing:devices');
    expect(apiContract).toContain('printing:summary');
    expect(apiContract).toContain('printing:worker-wakeup');
    expect(apiContract).toContain('printing.job_available');
    expect(apiContract).toContain('Realtime notifications are internal coordination signals');
    expect(apiContract).toContain('paperOrderNo');
    expect(apiContract).toContain('POST /api/print-worker/jobs/claim');
    expect(apiContract).toContain('POST /api/print-worker/jobs/{id}/succeed');
    expect(apiContract).toContain('POST /api/print-worker/jobs/{id}/fail');
    expect(apiContract).toContain('POST /api/public/work-orders/lookup');
    expect(apiContract).not.toContain('GET /api/public/work-orders/{paperOrderNo}?phoneLast4=1234');
    expect(apiContract).not.toContain('GET /api/print-jobs/next');
    expect(apiContract).not.toContain('POST /api/print-jobs/{id}/start');
    expect(apiContract).not.toContain('POST /api/print-jobs/{id}/result');
  });
});
