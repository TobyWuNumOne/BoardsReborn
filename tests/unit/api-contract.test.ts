import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiContract = readFileSync(resolve(process.cwd(), 'docs/api-contract.md'), 'utf8');

describe('API contract', () => {
  it('documents the paper order resolve flow and keeps UUID endpoints explicit', () => {
    expect(apiContract).toContain('GET /api/admin/work-orders/resolve');
    expect(apiContract).toContain('paperOrderNo=BR-2026-0001');
    expect(apiContract).toContain('GET /api/admin/work-orders/{id}');
    expect(apiContract).toContain('PATCH /api/admin/work-orders/{id}');
    expect(apiContract).toContain('POST /api/admin/work-orders/{id}/status');
  });
});
