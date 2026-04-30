import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiContract = readFileSync(resolve(process.cwd(), 'docs/api-contract.md'), 'utf8');

describe('API contract', () => {
  it('documents the admin session flow and keeps UUID work-order endpoints explicit', () => {
    expect(apiContract).toContain('GET /api/admin/dashboard');
    expect(apiContract).toContain('activeWorkOrdersByStatus');
    expect(apiContract).toContain('activeWorkOrdersByStatus.RECEIVED + DRYING + REPAIRING');
    expect(apiContract).toContain('GET /api/admin/session');
    expect(apiContract).toContain('這支 endpoint 只回傳最小必要欄位');
    expect(apiContract).toContain('GET /api/admin/work-orders/resolve');
    expect(apiContract).toContain('paperOrderNo=BR-2026-0001');
    expect(apiContract).toContain('GET /api/admin/work-orders/{id}');
    expect(apiContract).toContain('PATCH /api/admin/work-orders/{id}');
    expect(apiContract).toContain('POST /api/admin/work-orders/{id}/status');
  });
});
