import { existsSync, readFileSync } from 'node:fs';
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
  resolve(process.cwd(), 'supabase/migrations/20260527103000_printing_phase2_realtime_events.sql'),
  'utf8',
);
const printJobPayloadSnapshotMigration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260605140000_print_job_payload_snapshot_worker_receipt.sql',
  ),
  'utf8',
);
const printJobFullPhoneReceiptMigration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260605160000_print_job_full_phone_receipt_spacing.sql',
  ),
  'utf8',
);
const printJobEtaQuotePaymentSnapshotMigration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260605183000_print_job_eta_quote_payment_snapshot.sql',
  ),
  'utf8',
);
const repairMarksMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260609120000_work_order_repair_marks.sql'),
  'utf8',
);
const workOrderLabelRepairCountSnapshotMigration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260609224500_work_order_label_repair_count_snapshot.sql',
  ),
  'utf8',
);
const adminWorkOrderListGrantFixMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260611132000_admin_work_order_list_grant_fix.sql'),
  'utf8',
);
const customerReceiptPrintJobTypeMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260612110000_customer_receipt_print_job_type.sql'),
  'utf8',
);
const customerReceiptPrintJobSnapshotMigration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260612111000_customer_receipt_print_job_snapshot.sql',
  ),
  'utf8',
);
const lineReceiptPrintingMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260621094508_line_receipt_printing.sql'),
  'utf8',
);
const lineWebhookFriendshipMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260621103853_line_webhook_friendship_status.sql'),
  'utf8',
);
const lineJobsProcessorMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260622082705_line_jobs_processor.sql'),
  'utf8',
);
const readyLineNotificationMigrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260622090538_ready_line_notification.sql',
);
const receivedLineNotificationMigrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260622095620_work_order_received_line_notification.sql',
);
const autoNumericPaperOrderNoMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260612143000_auto_numeric_paper_order_no.sql'),
  'utf8',
);
const deleteAdminWorkOrderLockingMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260618161500_delete_admin_work_order_locking.sql'),
  'utf8',
);
const lineMvpFoundationMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260621062329_line_mvp_foundation.sql'),
  'utf8',
);
const lineBindTokenRpcsMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260621064536_line_bind_token_rpcs.sql'),
  'utf8',
);
const adminCustomerManagementMigration = existsSync(
  resolve(process.cwd(), 'supabase/migrations/20260629173000_admin_customer_management.sql'),
)
  ? readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260629173000_admin_customer_management.sql'),
      'utf8',
    )
  : '';
const adminLineBindingManagementMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260621065543_admin_line_binding_management.sql'),
  'utf8',
);
const publicLineBindingConfirmMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260621091907_public_line_binding_confirm.sql'),
  'utf8',
);
const lineConfirmServiceRoleCustomerLockGrantMigration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260625110031_line_confirm_service_role_customer_lock_grant.sql',
  ),
  'utf8',
);
const lineReadyNotificationServiceRoleWorkOrdersGrantMigration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260626214144_line_ready_notification_service_role_work_orders_grant.sql',
  ),
  'utf8',
);
const testPaperOrderNoMigrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260618110000_test_work_order_numbers.sql',
);
const testPaperOrderNoMigration = existsSync(testPaperOrderNoMigrationPath)
  ? readFileSync(testPaperOrderNoMigrationPath, 'utf8')
  : '';

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

  it('regrants admin_work_order_list after view recreation migrations', () => {
    expect(adminWorkOrderListGrantFixMigration).toContain(
      'grant select on table public.admin_work_order_list to authenticated',
    );
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
    expect(printQueueModelMigration).toContain('create type public.print_job_type as enum');
    expect(printQueueModelMigration).toContain('rename to print_job_status');
    expect(printQueueModelMigration).toContain('create table public.print_devices');
    expect(printQueueModelMigration).toContain(
      'create or replace view public.admin_print_job_list',
    );
    expect(printQueueModelMigration).toContain(
      'create or replace function public.create_admin_print_job',
    );
    expect(printQueueModelMigration).toContain(
      'create or replace function public.retry_admin_print_job',
    );
    expect(printQueueModelMigration).toContain(
      'create or replace function public.claim_next_print_job',
    );
    expect(printQueueModelMigration).toContain(
      'create or replace function public.mark_print_job_succeeded',
    );
    expect(printQueueModelMigration).toContain(
      'create or replace function public.mark_print_job_failed',
    );
    expect(printQueueModelMigration).toContain("when 'QUEUED' then 'pending'");
    expect(printQueueModelMigration).toContain("when 'FAILED_TRANSPORT' then 'failed'");
    expect(printQueueModelMigration).toContain(
      'grant execute on function public.claim_next_print_job',
    );
    expect(printQueueModelMigration).toContain(
      'grant select on table public.print_devices to authenticated',
    );
    expect(printQueueModelMigration).toContain(
      'grant select on table public.print_devices to service_role',
    );
  });

  it('adds the admin print device list projection for worker management UI', () => {
    expect(adminPrintDeviceListMigration).toContain(
      'create or replace view public.admin_print_device_list',
    );
    expect(adminPrintDeviceListMigration).toContain('current_job.job_id as current_job_id');
    expect(adminPrintDeviceListMigration).toContain(
      'recent_error.last_error as recent_error_message',
    );
    expect(adminPrintDeviceListMigration).toContain('concat_ws(');
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
      'perform realtime.send(v_payload, v_event, v_topic, true);',
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

  it('adds structured repair marks, repair count fields, and grants', () => {
    expect(repairMarksMigration).toContain(
      "create type public.repair_count_source as enum ('auto', 'manual')",
    );
    expect(repairMarksMigration).toContain(
      "create type public.repair_mark_board_side as enum ('front', 'back')",
    );
    expect(repairMarksMigration).toContain('alter table public.work_orders');
    expect(repairMarksMigration).toContain('add column repair_count smallint');
    expect(repairMarksMigration).toContain('add column repair_count_source');
    expect(repairMarksMigration).toContain('create table public.work_order_repair_marks');
    expect(repairMarksMigration).toContain('on delete cascade');
    expect(repairMarksMigration).toContain('x_ratio >= 0 and x_ratio <= 1');
    expect(repairMarksMigration).toContain('width_ratio > 0 and width_ratio <= 1');
    expect(repairMarksMigration).toContain(
      'alter table public.work_order_repair_marks enable row level security',
    );
    expect(repairMarksMigration).toContain(
      'create policy "Authenticated users can manage work order repair marks"',
    );
    expect(repairMarksMigration).toContain(
      'grant select, insert, update, delete on table public.work_order_repair_marks to authenticated',
    );
    expect(repairMarksMigration).toContain(
      'grant select on table public.work_order_repair_marks to service_role',
    );
  });

  it('generates numeric paper order numbers and guards hard delete', () => {
    expect(autoNumericPaperOrderNoMigration).toContain(
      'create or replace function public.get_next_admin_paper_order_no',
    );
    expect(autoNumericPaperOrderNoMigration).toContain("timezone('Asia/Taipei', now())");
    expect(autoNumericPaperOrderNoMigration).toContain(
      "to_char(timezone('Asia/Taipei', now()), 'YY')",
    );
    expect(autoNumericPaperOrderNoMigration).toContain(
      "pg_advisory_xact_lock(hashtext('work_order_paper_order_no'), v_year_suffix::integer)",
    );
    expect(autoNumericPaperOrderNoMigration).toContain(
      "work_orders.paper_order_no ~ ('^' || v_year_suffix || '[0-9]+$')",
    );
    expect(autoNumericPaperOrderNoMigration).toContain(
      "when length(v_next_sequence::text) < 4 then lpad(v_next_sequence::text, 4, '0')",
    );
    expect(autoNumericPaperOrderNoMigration).toContain('else v_next_sequence::text');
    expect(autoNumericPaperOrderNoMigration).toContain('return v_year_suffix || v_sequence_label');
    expect(autoNumericPaperOrderNoMigration).toContain(
      'v_paper_order_no := public.get_next_admin_paper_order_no(true)',
    );
    expect(autoNumericPaperOrderNoMigration).not.toContain(
      "v_paper_order_no := trim(p_work_order ->> 'paperOrderNo')",
    );
    expect(autoNumericPaperOrderNoMigration).toContain(
      'create or replace function public.delete_admin_work_order',
    );
    expect(autoNumericPaperOrderNoMigration).toContain(
      'where work_orders.id = p_work_order_id\n  for update;',
    );
    expect(autoNumericPaperOrderNoMigration).toContain(
      'perform 1\n  from public.print_jobs\n  where print_jobs.work_order_id = p_work_order_id\n  for update;',
    );
    expect(autoNumericPaperOrderNoMigration).toContain(
      "v_status <> 'RECEIVED'::public.work_order_status",
    );
    expect(autoNumericPaperOrderNoMigration).toContain("'locked'::public.print_job_status");
    expect(autoNumericPaperOrderNoMigration).toContain("'printing'::public.print_job_status");
    expect(autoNumericPaperOrderNoMigration).toContain("'printed'::public.print_job_status");
  });

  it('reserves the 99 namespace for editable test work orders', () => {
    expect(testPaperOrderNoMigration).toContain(
      'create or replace function public.get_next_admin_test_paper_order_no',
    );
    expect(testPaperOrderNoMigration).toContain("paper_order_no ~ '^99[0-9]+$'");
    expect(testPaperOrderNoMigration).toContain(
      "when length(v_next_sequence::text) < 4 then lpad(v_next_sequence::text, 4, '0')",
    );
    expect(testPaperOrderNoMigration).toContain("v_paper_order_mode = 'test'");
    expect(testPaperOrderNoMigration).toContain("v_paper_order_no !~ '^99[0-9]{4,}$'");
    expect(testPaperOrderNoMigration).toContain(
      'v_paper_order_no := public.get_next_admin_paper_order_no(true)',
    );
  });

  it('patches delete_admin_work_order for already-applied environments', () => {
    expect(deleteAdminWorkOrderLockingMigration).toContain(
      'create or replace function public.delete_admin_work_order',
    );
    expect(deleteAdminWorkOrderLockingMigration).toContain(
      'where work_orders.id = p_work_order_id\n  for update;',
    );
    expect(deleteAdminWorkOrderLockingMigration).toContain(
      'perform 1\n  from public.print_jobs\n  where print_jobs.work_order_id = p_work_order_id\n  for update;',
    );
  });

  it('adds immutable print snapshot helpers for Pi worker receipts', () => {
    expect(printJobPayloadSnapshotMigration).toContain(
      'create or replace function public.to_printable_ascii',
    );
    expect(printJobPayloadSnapshotMigration).toContain(
      'create or replace function public.mask_print_phone',
    );
    expect(printJobPayloadSnapshotMigration).toContain(
      'create or replace function public.build_print_barcode_value',
    );
    expect(printJobPayloadSnapshotMigration).toContain("'templateVersion', 1");
    expect(printJobPayloadSnapshotMigration).toContain("'barcodeValue', v_barcode_value");
    expect(printJobPayloadSnapshotMigration).toContain(
      "'customerNameAscii', v_customer_name_ascii",
    );
    expect(printJobPayloadSnapshotMigration).toContain("'maskedPhone', v_masked_phone");
    expect(printJobPayloadSnapshotMigration).toContain("'boardType', v_board_type");
    expect(printJobPayloadSnapshotMigration).toContain('Print barcode value is invalid');
    expect(printJobPayloadSnapshotMigration).toContain('length(v_barcode_value) < 4');
    expect(printJobPayloadSnapshotMigration).toContain('length(v_barcode_value) > 32');
  });

  it('updates new print snapshots to use full customer phone for receipt display', () => {
    expect(printJobFullPhoneReceiptMigration).toContain(
      'create or replace function public.build_print_phone_value',
    );
    expect(printJobFullPhoneReceiptMigration).toContain("'customerPhone', v_print_phone");
    expect(printJobFullPhoneReceiptMigration).not.toContain("'maskedPhone', v_masked_phone");
    expect(printJobFullPhoneReceiptMigration).toContain(
      "select nullif(regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g'), '');",
    );
  });

  it('extends print snapshots with eta, initial quote, and payment status', () => {
    expect(printJobEtaQuotePaymentSnapshotMigration).toContain("and item_type = 'INITIAL'");
    expect(printJobEtaQuotePaymentSnapshotMigration).toContain(
      "'estimatedCompletionDate', v_work_order.estimated_completion_date",
    );
    expect(printJobEtaQuotePaymentSnapshotMigration).toContain(
      "'initialQuoteAmount', v_initial_quote_amount",
    );
    expect(printJobEtaQuotePaymentSnapshotMigration).toContain(
      "'paymentReceived', v_work_order.payment_received",
    );
  });

  it('replaces work-order label snapshots with the repair-count-aware payload', () => {
    expect(workOrderLabelRepairCountSnapshotMigration).toContain(
      "raise exception 'Print repair count is required'",
    );
    expect(workOrderLabelRepairCountSnapshotMigration).toContain("'templateVersion', 2");
    expect(workOrderLabelRepairCountSnapshotMigration).toContain("'displayOrderNumber'");
    expect(workOrderLabelRepairCountSnapshotMigration).toContain("'intakeDate'");
    expect(workOrderLabelRepairCountSnapshotMigration).toContain("'customerPhone'");
    expect(workOrderLabelRepairCountSnapshotMigration).toContain("'paymentReceived'");
    expect(workOrderLabelRepairCountSnapshotMigration).toContain("'repairCount'");
  });

  it('adds customer receipt as a separate print job snapshot', () => {
    expect(customerReceiptPrintJobTypeMigration).toContain(
      "alter type public.print_job_type add value if not exists 'customer_receipt'",
    );
    expect(customerReceiptPrintJobSnapshotMigration).toContain(
      'drop function if exists public.create_admin_print_job(uuid, public.print_job_type, uuid)',
    );
    expect(customerReceiptPrintJobSnapshotMigration).toContain(
      'p_public_lookup_url text default null',
    );
    expect(customerReceiptPrintJobSnapshotMigration).toContain(
      "v_job_type = 'customer_receipt'::public.print_job_type",
    );
    expect(customerReceiptPrintJobSnapshotMigration).toContain("'templateVersion', 1");
    expect(customerReceiptPrintJobSnapshotMigration).toContain("'boardTypeLabel'");
    expect(customerReceiptPrintJobSnapshotMigration).toContain("'publicLookupUrl'");
    expect(customerReceiptPrintJobSnapshotMigration).toContain(
      "raise exception 'Print repair count is required'",
    );
    expect(customerReceiptPrintJobSnapshotMigration).toContain(
      "raise exception 'Print public lookup URL is required'",
    );
    expect(customerReceiptPrintJobSnapshotMigration).toContain(
      'grant execute on function public.create_admin_print_job(uuid, public.print_job_type, uuid, text) to authenticated',
    );
  });

  it('stores only non-sensitive LINE receipt QR metadata', () => {
    expect(lineReceiptPrintingMigration).toContain("'qrKind', p_qr_kind");
    expect(lineReceiptPrintingMigration).toContain("'lineBindTokenId', p_line_bind_token_id");
    expect(lineReceiptPrintingMigration).not.toContain("'publicLookupUrl'");
    expect(lineReceiptPrintingMigration).toContain(
      'line_bind_tokens.work_order_id = p_work_order_id',
    );
  });

  it('adds a dedicated friendship check timestamp without changing LINE RLS', () => {
    expect(lineWebhookFriendshipMigration).toContain(
      'add column friendship_checked_at timestamptz',
    );
    expect(lineWebhookFriendshipMigration).toContain(
      'customer_line_accounts_friendship_checked_at_valid',
    );
    expect(lineWebhookFriendshipMigration).not.toContain('create policy');
  });

  it('adds atomic LINE job claim, prepare and result transactions', () => {
    expect(lineJobsProcessorMigration).toContain("rename value 'processing' to 'locked'");
    expect(lineJobsProcessorMigration).toContain(
      "add value if not exists 'recipient_binding_changed'",
    );
    expect(lineJobsProcessorMigration).toContain('prepared_messages jsonb');
    expect(lineJobsProcessorMigration).toContain('first_attempt_at timestamptz');
    expect(lineJobsProcessorMigration).toContain('for update skip locked');
    expect(lineJobsProcessorMigration).toContain(
      'create or replace function public.claim_line_jobs',
    );
    expect(lineJobsProcessorMigration).toContain(
      'create or replace function public.prepare_line_job',
    );
    expect(lineJobsProcessorMigration).toContain(
      'create or replace function public.record_line_job_result',
    );
    expect(lineJobsProcessorMigration).toContain(
      'notified_at = coalesce(work_orders.notified_at, v_sent_at)',
    );
    expect(lineJobsProcessorMigration).not.toContain('create policy');
  });

  it('enqueues the READY LINE outbox event inside the status transition transaction', () => {
    expect(existsSync(readyLineNotificationMigrationPath)).toBe(true);
    const readyLineNotificationMigration = readFileSync(readyLineNotificationMigrationPath, 'utf8');

    expect(readyLineNotificationMigration).toContain(
      'create or replace function public.transition_admin_work_order_status',
    );
    expect(readyLineNotificationMigration).toContain(
      "'work_order_ready_for_pickup:' || p_work_order_id::text",
    );
    expect(readyLineNotificationMigration).toContain('insert into public.line_jobs');
    expect(readyLineNotificationMigration).toContain('on conflict (dedupe_key)');
    expect(readyLineNotificationMigration).toContain("'NO_ACTIVE_LINE_BINDING'");
    expect(readyLineNotificationMigration).toContain("'ALREADY_NOTIFIED'");
    expect(readyLineNotificationMigration).toContain("'JOB_ALREADY_EXISTS'");
    expect(readyLineNotificationMigration).toContain("'NOT_READY_FOR_PICKUP'");
    expect(readyLineNotificationMigration).not.toContain('line_user_id');
    expect(readyLineNotificationMigration).not.toContain('phone');
  });

  it('adds a best-effort work-order received enqueue transaction', () => {
    expect(existsSync(receivedLineNotificationMigrationPath)).toBe(true);
    const receivedMigration = readFileSync(receivedLineNotificationMigrationPath, 'utf8');

    expect(receivedMigration).toContain(
      'create or replace function public.enqueue_work_order_received_line_job',
    );
    expect(receivedMigration).toContain("'work_order_received:' || p_work_order_id::text");
    expect(receivedMigration).toContain("'work_order_received'::public.line_job_type");
    expect(receivedMigration).toContain('insert into public.line_jobs');
    expect(receivedMigration).toContain('on conflict (dedupe_key)');
    expect(receivedMigration).toContain("'NO_ACTIVE_LINE_BINDING'");
    expect(receivedMigration).toContain("'JOB_ALREADY_EXISTS'");
    expect(receivedMigration).not.toContain('line_user_id');
    expect(receivedMigration).not.toContain('phone');
    expect(receivedMigration).not.toContain('token');
  });

  it('adds the LINE MVP enums and relational tables', () => {
    expect(lineMvpFoundationMigration).toContain('create type public.line_job_type as enum');
    expect(lineMvpFoundationMigration).toContain('create type public.line_job_status as enum');
    expect(lineMvpFoundationMigration).toContain('create type public.line_job_skip_reason as enum');
    expect(lineMvpFoundationMigration).toContain('create table public.customer_line_accounts');
    expect(lineMvpFoundationMigration).toContain('create table public.line_bind_tokens');
    expect(lineMvpFoundationMigration).toContain('create table public.line_jobs');
  });

  it('enforces LINE binding, token, and job uniqueness in the database', () => {
    expect(lineMvpFoundationMigration).toContain('work_orders_id_customer_id_key');
    expect(lineMvpFoundationMigration).toContain('customer_line_accounts_customer_id_key');
    expect(lineMvpFoundationMigration).toContain('customer_line_accounts_line_user_id_key');
    expect(lineMvpFoundationMigration).toContain('line_bind_tokens_token_hash_key');
    expect(lineMvpFoundationMigration).toContain('line_bind_tokens_one_pending_per_customer_idx');
    expect(lineMvpFoundationMigration).toContain('where used_at is null and revoked_at is null');
    expect(lineMvpFoundationMigration).toContain('line_jobs_retry_key_key');
    expect(lineMvpFoundationMigration).toContain('line_jobs_dedupe_key_idx');
    expect(lineMvpFoundationMigration).toContain('where dedupe_key is not null');
    expect(lineMvpFoundationMigration).toContain('line_bind_tokens_work_order_customer_fk');
    expect(lineMvpFoundationMigration).toContain('line_jobs_work_order_customer_fk');
  });

  it('adds LINE claim, reclaim, token, and history indexes', () => {
    expect(lineMvpFoundationMigration).toContain('line_bind_tokens_customer_created_at_idx');
    expect(lineMvpFoundationMigration).toContain('line_bind_tokens_work_order_created_at_idx');
    expect(lineMvpFoundationMigration).toContain('line_jobs_pending_claim_idx');
    expect(lineMvpFoundationMigration).toContain('line_jobs_processing_reclaim_idx');
    expect(lineMvpFoundationMigration).toContain('line_jobs_customer_created_at_idx');
    expect(lineMvpFoundationMigration).toContain('line_jobs_work_order_created_at_idx');
  });

  it('protects LINE tables with admin-scoped RLS and explicit grants', () => {
    for (const table of ['customer_line_accounts', 'line_bind_tokens', 'line_jobs']) {
      expect(lineMvpFoundationMigration).toContain(
        `alter table public.${table} enable row level security`,
      );
    }
    expect(lineMvpFoundationMigration).toContain('from public.admin_profiles');
    expect(lineMvpFoundationMigration).toContain('auth.uid()');
    expect(lineMvpFoundationMigration).not.toContain('to authenticated\nusing (true)');
    expect(lineMvpFoundationMigration).not.toContain('to anon');
    expect(lineMvpFoundationMigration).toContain(
      'grant select, insert, update, delete on table public.customer_line_accounts to authenticated',
    );
    expect(lineMvpFoundationMigration).toContain(
      'grant select, insert, update, delete on table public.line_bind_tokens to service_role',
    );
    expect(lineMvpFoundationMigration).toContain(
      'grant select, insert, update, delete on table public.line_jobs to service_role',
    );
  });

  it('adds atomic LINE bind token issue and revoke RPCs', () => {
    expect(lineBindTokenRpcsMigration).toContain(
      'create or replace function public.issue_line_bind_token',
    );
    expect(lineBindTokenRpcsMigration).toContain(
      'create or replace function public.revoke_pending_line_bind_tokens',
    );
    expect(lineBindTokenRpcsMigration).toContain('security invoker');
    expect(lineBindTokenRpcsMigration).toContain('from public.customers');
    expect(lineBindTokenRpcsMigration).toContain('for update');
    expect(lineBindTokenRpcsMigration).toContain('update public.line_bind_tokens');
    expect(lineBindTokenRpcsMigration).toContain('insert into public.line_bind_tokens');
    expect(lineBindTokenRpcsMigration).toContain("statement_timestamp() + interval '30 days'");
    expect(lineBindTokenRpcsMigration).not.toContain('plaintext');
    expect(lineBindTokenRpcsMigration).not.toContain('LINE_BIND_TOKEN_SECRET');
    expect(lineBindTokenRpcsMigration).toContain(
      'revoke all on function public.issue_line_bind_token',
    );
    expect(lineBindTokenRpcsMigration).toContain(
      'grant execute on function public.issue_line_bind_token',
    );
  });

  it('adds atomic admin LINE issue and unlink transactions', () => {
    expect(adminLineBindingManagementMigration).toContain(
      'create or replace function public.issue_admin_line_bind_token',
    );
    expect(adminLineBindingManagementMigration).toContain(
      'create or replace function public.unlink_admin_customer_line_binding',
    );
    expect(adminLineBindingManagementMigration).toContain('security invoker');
    expect(adminLineBindingManagementMigration).toContain('for update');
    expect(adminLineBindingManagementMigration).toContain(
      'Customer already has active LINE binding',
    );
    expect(adminLineBindingManagementMigration).toContain(
      'delete from public.customer_line_accounts',
    );
    expect(adminLineBindingManagementMigration).toContain(
      "status = 'skipped'::public.line_job_status",
    );
    expect(adminLineBindingManagementMigration).toContain(
      "and status = 'pending'::public.line_job_status",
    );
    expect(adminLineBindingManagementMigration).not.toContain(
      "and status = 'processing'::public.line_job_status",
    );
    expect(adminLineBindingManagementMigration).not.toContain('binding_history');
  });

  it('adds an atomic public LINE confirm transaction with outbox selection', () => {
    expect(publicLineBindingConfirmMigration).toContain(
      'create or replace function public.confirm_public_line_binding',
    );
    expect(publicLineBindingConfirmMigration).toContain('for update');
    expect(publicLineBindingConfirmMigration).toContain("'line_conflict'");
    expect(publicLineBindingConfirmMigration).toContain("'customer_conflict'");
    expect(publicLineBindingConfirmMigration).toContain('update public.line_bind_tokens');
    expect(publicLineBindingConfirmMigration).toContain(
      'insert into public.customer_line_accounts',
    );
    expect(publicLineBindingConfirmMigration).toContain('insert into public.line_jobs');
    expect(publicLineBindingConfirmMigration).toContain(
      "current_status = 'READY_FOR_PICKUP'::public.work_order_status",
    );
    expect(publicLineBindingConfirmMigration).toContain(
      "'work_order_ready_for_pickup'::public.line_job_type",
    );
    expect(publicLineBindingConfirmMigration).toContain(
      "'line_binding_success'::public.line_job_type",
    );
    expect(publicLineBindingConfirmMigration).not.toContain('http');
    expect(lineConfirmServiceRoleCustomerLockGrantMigration).toContain(
      'grant update on table public.customers to service_role',
    );
    expect(lineReadyNotificationServiceRoleWorkOrdersGrantMigration).toContain(
      'grant update on table public.work_orders to service_role',
    );
  });

  it('adds admin customer management read model and transfer RPC', () => {
    expect(adminCustomerManagementMigration).toContain(
      'create or replace view public.admin_customer_list',
    );
    expect(adminCustomerManagementMigration).toContain('work_order_count');
    expect(adminCustomerManagementMigration).toContain('active_work_order_count');
    expect(adminCustomerManagementMigration).toContain('latest_work_order_id');
    expect(adminCustomerManagementMigration).toContain('line_notify_status');
    expect(adminCustomerManagementMigration).toContain(
      'grant select on table public.admin_customer_list to authenticated',
    );
    expect(adminCustomerManagementMigration).toContain(
      'create or replace function public.transfer_admin_work_order_customer',
    );
    expect(adminCustomerManagementMigration).toContain(
      'grant execute on function public.transfer_admin_work_order_customer(uuid, uuid) to authenticated',
    );
  });
});
