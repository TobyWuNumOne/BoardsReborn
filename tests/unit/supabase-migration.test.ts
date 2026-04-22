import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260421090000_initial_schema.sql'),
  'utf8',
);

describe('initial Supabase migration', () => {
  it('keeps pickup fields inline on work_orders', () => {
    expect(migration).toContain('create table public.work_orders');
    expect(migration).toContain('notified_at timestamptz');
    expect(migration).toContain('picked_up_at timestamptz');
    expect(migration).toContain('pickup_note text');
    expect(migration).not.toContain('create table public.pickup_info');
  });

  it('enforces key business constraints in the database', () => {
    expect(migration).toContain('work_orders_paper_order_no_length');
    expect(migration).toContain('work_orders_snowboard_no_drying');
    expect(migration).toContain('quote_items_one_initial_per_work_order_idx');
    expect(migration).toContain("where item_type = 'INITIAL'");
  });

  it('enables RLS and configures private repair photo storage', () => {
    expect(migration).toContain('alter table public.work_orders enable row level security');
    expect(migration).toContain('alter table public.print_jobs enable row level security');
    expect(migration).toContain("values (\n  'repair-photos'");
    expect(migration).toContain('public = excluded.public');
    expect(migration).toContain("bucket_id = 'repair-photos'");
  });
});
