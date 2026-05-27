import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260421090000_initial_schema.sql'),
  'utf8',
);
const adminApiMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260422110000_admin_work_order_api.sql'),
  'utf8',
);
const statusTransitionMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260422120000_admin_status_transition.sql'),
  'utf8',
);
const boardLengthClassMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260504110000_work_order_board_length_class.sql'),
  'utf8',
);
const authenticatedTableGrantsMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260505160000_authenticated_table_grants.sql'),
  'utf8',
);
const publicLookupServiceRoleGrantsMigration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260506143000_public_lookup_service_role_grants.sql',
  ),
  'utf8',
);
const printQueueModelMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260521110000_print_queue_model.sql'),
  'utf8',
);
const adminPrintDeviceListMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260522103000_admin_print_device_list.sql'),
  'utf8',
);
const printingRealtimeBroadcastMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260526143000_printing_realtime_broadcast.sql'),
  'utf8',
);
const printingRealtimeBroadcastJoinPolicyMigration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260526152000_printing_realtime_broadcast_join_policy.sql',
  ),
  'utf8',
);
const printingPhase2RealtimeEventsMigration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260527103000_printing_phase2_realtime_events.sql',
  ),
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

  it('adds admin work-order API database support without coupling print jobs to create', () => {
    expect(adminApiMigration).toContain(
      'create or replace function public.normalize_tw_mobile_phone',
    );
    expect(adminApiMigration).toContain('normalized_phone varchar(10)');
    expect(adminApiMigration).toContain('customers_normalized_phone_idx');
    expect(adminApiMigration).not.toContain('unique index customers_normalized_phone');
    expect(adminApiMigration).toContain(
      'create or replace function public.create_admin_work_order',
    );
    expect(adminApiMigration).toContain('insert into public.customers');
    expect(adminApiMigration).toContain('insert into public.work_orders');
    expect(adminApiMigration).toContain('insert into public.status_history');
    expect(adminApiMigration).toContain('insert into public.quote_items');
    expect(adminApiMigration).not.toContain('insert into public.print_jobs');
  });

  it('adds an atomic admin status transition RPC', () => {
    expect(statusTransitionMigration).toContain(
      'create or replace function public.transition_admin_work_order_status',
    );
    expect(statusTransitionMigration).toContain('security invoker');
    expect(statusTransitionMigration).toContain('for update');
    expect(statusTransitionMigration).toContain('insert into public.status_history');
    expect(statusTransitionMigration).toContain('current_status = p_status');
    expect(statusTransitionMigration).toContain('coalesce(ready_for_pickup_at, v_transitioned_at)');
    expect(statusTransitionMigration).toContain('coalesce(delivered_at, v_transitioned_at)');
    expect(statusTransitionMigration).toContain('coalesce(cancelled_at, v_transitioned_at)');
    expect(statusTransitionMigration).toContain('SNOWBOARD work orders cannot enter DRYING');
    expect(statusTransitionMigration).not.toContain('insert into public.print_jobs');
  });

  it('adds board_length_class without breaking legacy work order rows', () => {
    expect(boardLengthClassMigration).toContain('create type public.board_length_class as enum');
    expect(boardLengthClassMigration).toContain(
      'alter table public.work_orders\nadd column board_length_class public.board_length_class',
    );
    expect(boardLengthClassMigration).toContain(
      'create or replace function public.enforce_work_order_board_length_class',
    );
    expect(boardLengthClassMigration).toContain(
      'before insert or update of board_type, board_length_class on public.work_orders',
    );
    expect(boardLengthClassMigration).toContain('SURFBOARD work orders require board_length_class');
    expect(boardLengthClassMigration).toContain(
      'Only SURFBOARD work orders can set board_length_class',
    );
    expect(boardLengthClassMigration).toContain('work_orders.board_length_class');
    expect(boardLengthClassMigration).toContain("p_board ->> 'boardLengthClass'");
  });

  it('grants authenticated table privileges for user-scoped admin APIs', () => {
    expect(authenticatedTableGrantsMigration).toContain(
      'grant usage on schema public to authenticated',
    );
    expect(authenticatedTableGrantsMigration).toContain('public.admin_profiles');
    expect(authenticatedTableGrantsMigration).toContain('public.work_orders');
    expect(authenticatedTableGrantsMigration).toContain('public.status_history');
    expect(authenticatedTableGrantsMigration).toContain(
      'grant select on table public.admin_work_order_list to authenticated',
    );
    expect(authenticatedTableGrantsMigration).not.toContain('to anon');
  });

  it('grants minimal service_role read access for public lookup queries', () => {
    expect(publicLookupServiceRoleGrantsMigration).toContain(
      'grant usage on schema public to service_role',
    );
    expect(publicLookupServiceRoleGrantsMigration).toContain('public.customers');
    expect(publicLookupServiceRoleGrantsMigration).toContain('public.work_orders');
    expect(publicLookupServiceRoleGrantsMigration).toContain('public.quote_items');
    expect(publicLookupServiceRoleGrantsMigration).toContain('to service_role');
    expect(publicLookupServiceRoleGrantsMigration).not.toContain('insert');
    expect(publicLookupServiceRoleGrantsMigration).not.toContain('update');
    expect(publicLookupServiceRoleGrantsMigration).not.toContain('delete');
  });

  it('adds the print queue model, admin list view, and worker RPCs', () => {
    expect(printQueueModelMigration).toContain('create type public.print_device_status as enum');
    expect(printQueueModelMigration).toContain("create type public.print_job_type as enum");
    expect(printQueueModelMigration).toContain("rename to print_job_status");
    expect(printQueueModelMigration).toContain('create table public.print_devices');
    expect(printQueueModelMigration).toContain('create or replace view public.admin_print_job_list');
    expect(printQueueModelMigration).toContain('create or replace function public.create_admin_print_job');
    expect(printQueueModelMigration).toContain('create or replace function public.retry_admin_print_job');
    expect(printQueueModelMigration).toContain('create or replace function public.claim_next_print_job');
    expect(printQueueModelMigration).toContain(
      'create or replace function public.mark_print_job_succeeded',
    );
    expect(printQueueModelMigration).toContain(
      'create or replace function public.mark_print_job_failed',
    );
    expect(printQueueModelMigration).toContain("when 'QUEUED' then 'pending'");
    expect(printQueueModelMigration).toContain("when 'FAILED_TRANSPORT' then 'failed'");
    expect(printQueueModelMigration).toContain("grant execute on function public.claim_next_print_job");
    expect(printQueueModelMigration).toContain('grant select on table public.print_devices to authenticated');
    expect(printQueueModelMigration).toContain('grant select on table public.print_devices to service_role');
  });

  it('adds the admin print device list projection for worker management UI', () => {
    expect(adminPrintDeviceListMigration).toContain(
      'create or replace view public.admin_print_device_list',
    );
    expect(adminPrintDeviceListMigration).toContain("current_job.job_id as current_job_id");
    expect(adminPrintDeviceListMigration).toContain(
      "recent_error.last_error as recent_error_message",
    );
    expect(adminPrintDeviceListMigration).toContain("concat_ws(");
    expect(adminPrintDeviceListMigration).toContain(
      'grant select on table public.admin_print_device_list to authenticated',
    );
  });

  it('adds admin-only realtime broadcast policies and triggers for printing changes', () => {
    expect(printingRealtimeBroadcastMigration).toContain(
      'create policy "admin profiles can listen to printing broadcasts"',
    );
    expect(printingRealtimeBroadcastMigration).toContain('on realtime.messages');
    expect(printingRealtimeBroadcastMigration).toContain("realtime.topic() like 'printing:%'");
    expect(printingRealtimeBroadcastMigration).toContain('from public.admin_profiles');
    expect(printingRealtimeBroadcastMigration).toContain(
      'create or replace function public.notify_printing_realtime()',
    );
    expect(printingRealtimeBroadcastMigration).toContain(
      "perform realtime.send(v_payload, v_event, v_topic, true);",
    );
    expect(printingRealtimeBroadcastMigration).toContain("'printing:jobs'");
    expect(printingRealtimeBroadcastMigration).toContain("'printing:devices'");
    expect(printingRealtimeBroadcastMigration).toContain("'printing:summary'");
    expect(printingRealtimeBroadcastMigration).toContain(
      'create trigger notify_print_jobs_realtime',
    );
    expect(printingRealtimeBroadcastMigration).toContain(
      'create trigger notify_print_devices_realtime',
    );
    expect(printingRealtimeBroadcastJoinPolicyMigration).toContain(
      'create policy "admin profiles can join printing broadcast topics"',
    );
    expect(printingRealtimeBroadcastJoinPolicyMigration).toContain('on realtime.messages');
    expect(printingRealtimeBroadcastJoinPolicyMigration).toContain('for insert');
    expect(printingRealtimeBroadcastJoinPolicyMigration).toContain(
      "realtime.messages.extension = 'broadcast'",
    );
    expect(printingRealtimeBroadcastJoinPolicyMigration).toContain(
      "realtime.topic() like 'printing:%'",
    );
    expect(printingRealtimeBroadcastJoinPolicyMigration).toContain('from public.admin_profiles');
  });

  it('adds a server-callable realtime emit function for phase 2 printing events', () => {
    expect(printingPhase2RealtimeEventsMigration).toContain(
      'drop trigger if exists notify_print_jobs_realtime on public.print_jobs',
    );
    expect(printingPhase2RealtimeEventsMigration).toContain(
      'drop trigger if exists notify_print_devices_realtime on public.print_devices',
    );
    expect(printingPhase2RealtimeEventsMigration).toContain(
      'create or replace function public.emit_printing_realtime_event',
    );
    expect(printingPhase2RealtimeEventsMigration).toContain(
      'perform realtime.send(p_payload, p_event, p_topic, p_is_private);',
    );
    expect(printingPhase2RealtimeEventsMigration).toContain(
      'grant execute on function public.emit_printing_realtime_event(jsonb, text, text, boolean) to authenticated',
    );
    expect(printingPhase2RealtimeEventsMigration).toContain(
      'grant execute on function public.emit_printing_realtime_event(jsonb, text, text, boolean) to service_role',
    );
  });
});
