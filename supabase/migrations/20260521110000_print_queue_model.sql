set check_function_bodies = off;

create type public.print_device_status as enum (
  'active',
  'inactive',
  'error'
);

create type public.print_job_type as enum (
  'work_order_label'
);

create type public.print_job_status_new as enum (
  'pending',
  'locked',
  'printing',
  'printed',
  'failed',
  'cancelled'
);

create table public.print_devices (
  id uuid primary key default extensions.gen_random_uuid(),
  name varchar(80) not null,
  device_key varchar(120) not null,
  location varchar(120),
  status public.print_device_status not null default 'active',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint print_devices_name_not_blank check (length(trim(name)) > 0),
  constraint print_devices_device_key_not_blank check (length(trim(device_key)) > 0),
  constraint print_devices_device_key_key unique (device_key)
);

create index print_devices_status_idx
  on public.print_devices (status);

alter table public.print_jobs
drop constraint if exists print_jobs_work_order_paper_order_fk;

drop index if exists public.print_jobs_paper_order_no_idx;
drop index if exists public.print_jobs_claimed_by_claimed_at_idx;

alter table public.print_jobs
drop constraint if exists print_jobs_paper_order_no_length;

alter table public.print_jobs
drop constraint if exists print_jobs_label_payload_object;

alter table public.print_jobs
rename column label_payload to payload;

alter table public.print_jobs
rename column claimed_at to locked_at;

alter table public.print_jobs
rename column claimed_by to locked_by;

alter table public.print_jobs
add column print_device_id uuid references public.print_devices (id) on delete set null,
add column job_type public.print_job_type not null default 'work_order_label',
add column max_attempts smallint not null default 3;

alter table public.print_jobs
alter column locked_by type varchar(120);

alter table public.print_jobs
alter column status drop default;

alter table public.print_jobs
alter column status type public.print_job_status_new
using (
  case status::text
    when 'QUEUED' then 'pending'
    when 'REPRINT_REQUESTED' then 'pending'
    when 'PROCESSING' then 'locked'
    when 'SENT_TO_PRINTER' then 'printed'
    when 'PRINTER_READY_AFTER_SEND' then 'printed'
    when 'FAILED_TRANSPORT' then 'failed'
    when 'FAILED_PRINTER_STATUS' then 'failed'
    when 'UNKNOWN' then 'failed'
    else 'pending'
  end
)::public.print_job_status_new;

drop type public.print_job_status;

alter type public.print_job_status_new
rename to print_job_status;

alter table public.print_jobs
alter column status set default 'pending'::public.print_job_status;

update public.print_jobs
set printed_at = coalesce(printed_at, updated_at)
where status = 'printed'::public.print_job_status
  and printed_at is null;

alter table public.print_jobs
drop column label_language,
drop column paper_order_no;

alter table public.print_jobs
add constraint print_jobs_work_order_id_fkey
foreign key (work_order_id)
references public.work_orders (id)
on delete cascade;

alter table public.print_jobs
add constraint print_jobs_payload_object check (jsonb_typeof(payload) = 'object'),
add constraint print_jobs_max_attempts_positive check (max_attempts > 0);

create index print_jobs_print_device_created_at_idx
  on public.print_jobs (print_device_id, created_at desc);

create index print_jobs_locked_at_idx
  on public.print_jobs (locked_at)
  where status = 'locked'::public.print_job_status;

create trigger set_print_devices_updated_at
before update on public.print_devices
for each row execute function public.set_updated_at();

alter table public.print_devices enable row level security;

create policy "Authenticated users can manage print devices"
on public.print_devices
for all
to authenticated
using (true)
with check (true);

create or replace view public.admin_print_job_list
with (security_invoker = true) as
select
  print_jobs.id,
  print_jobs.work_order_id,
  work_orders.paper_order_no,
  customers.name as customer_name,
  work_orders.board_type,
  work_orders.board_length_class,
  print_jobs.print_device_id,
  print_devices.name as print_device_name,
  print_jobs.job_type,
  print_jobs.status,
  print_jobs.attempt_count,
  print_jobs.max_attempts,
  print_jobs.last_error,
  print_jobs.locked_at,
  print_jobs.locked_by,
  print_jobs.printed_at,
  print_jobs.created_at,
  print_jobs.updated_at
from public.print_jobs
join public.work_orders on work_orders.id = print_jobs.work_order_id
join public.customers on customers.id = work_orders.customer_id
left join public.print_devices on print_devices.id = print_jobs.print_device_id;

create or replace function public.create_admin_print_job(
  p_work_order_id uuid,
  p_job_type public.print_job_type default 'work_order_label',
  p_created_by_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_customer_name varchar(80);
  v_job public.print_jobs%rowtype;
  v_work_order public.work_orders%rowtype;
begin
  select *
  into v_work_order
  from public.work_orders
  where id = p_work_order_id;

  if not found then
    raise exception 'Work order not found'
      using errcode = 'P0002';
  end if;

  select name
  into v_customer_name
  from public.customers
  where id = v_work_order.customer_id;

  insert into public.print_jobs (
    work_order_id,
    job_type,
    status,
    payload,
    attempt_count,
    max_attempts,
    created_by_user_id
  )
  values (
    v_work_order.id,
    p_job_type,
    'pending'::public.print_job_status,
    jsonb_build_object(
      'paperOrderNo', v_work_order.paper_order_no,
      'customerName', v_customer_name,
      'boardType', v_work_order.board_type,
      'boardLengthClass', v_work_order.board_length_class,
      'createdAt', v_work_order.created_at
    ),
    0,
    3,
    p_created_by_user_id
  )
  returning * into v_job;

  return jsonb_build_object(
    'id', v_job.id,
    'workOrderId', v_job.work_order_id,
    'jobType', v_job.job_type,
    'status', v_job.status,
    'attemptCount', v_job.attempt_count,
    'maxAttempts', v_job.max_attempts,
    'createdAt', v_job.created_at,
    'updatedAt', v_job.updated_at
  );
end;
$$;

create or replace function public.retry_admin_print_job(
  p_print_job_id uuid,
  p_requested_by_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_job public.print_jobs%rowtype;
begin
  select *
  into v_job
  from public.print_jobs
  where id = p_print_job_id
  for update;

  if not found then
    raise exception 'Print job not found'
      using errcode = 'P0002';
  end if;

  if v_job.status <> 'failed'::public.print_job_status then
    raise exception 'Only failed print jobs can be retried'
      using errcode = '23514';
  end if;

  update public.print_jobs
  set
    status = 'pending'::public.print_job_status,
    last_error = null,
    locked_at = null,
    locked_by = null
  where id = v_job.id
  returning * into v_job;

  return jsonb_build_object(
    'id', v_job.id,
    'workOrderId', v_job.work_order_id,
    'jobType', v_job.job_type,
    'status', v_job.status,
    'attemptCount', v_job.attempt_count,
    'maxAttempts', v_job.max_attempts,
    'updatedAt', v_job.updated_at
  );
end;
$$;

create or replace function public.claim_next_print_job(
  p_device_key text,
  p_stale_lock_seconds integer default 300
)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_device public.print_devices%rowtype;
  v_job public.print_jobs%rowtype;
begin
  select *
  into v_device
  from public.print_devices
  where device_key = trim(p_device_key);

  if not found then
    raise exception 'Print device not found'
      using errcode = 'P0002';
  end if;

  if v_device.status <> 'active'::public.print_device_status then
    raise exception 'Print device is inactive'
      using errcode = '42501';
  end if;

  update public.print_devices
  set last_seen_at = now()
  where id = v_device.id;

  with next_job as (
    select id
    from public.print_jobs
    where status = 'pending'::public.print_job_status
      or (
        status = 'locked'::public.print_job_status
        and locked_at is not null
        and locked_at <= now() - make_interval(secs => p_stale_lock_seconds)
      )
    order by
      case when status = 'pending'::public.print_job_status then 0 else 1 end,
      created_at asc
    for update skip locked
    limit 1
  )
  update public.print_jobs
  set
    status = 'locked'::public.print_job_status,
    locked_at = now(),
    locked_by = v_device.device_key,
    print_device_id = v_device.id
  where id = (select id from next_job)
  returning * into v_job;

  if not found then
    return jsonb_build_object('job', null);
  end if;

  return jsonb_build_object(
    'job',
    jsonb_build_object(
      'id', v_job.id,
      'workOrderId', v_job.work_order_id,
      'jobType', v_job.job_type,
      'payload', v_job.payload,
      'attemptCount', v_job.attempt_count,
      'maxAttempts', v_job.max_attempts,
      'lockedAt', v_job.locked_at,
      'createdAt', v_job.created_at
    )
  );
end;
$$;

create or replace function public.mark_print_job_succeeded(
  p_print_job_id uuid,
  p_device_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_job public.print_jobs%rowtype;
begin
  select *
  into v_job
  from public.print_jobs
  where id = p_print_job_id
  for update;

  if not found then
    raise exception 'Print job not found'
      using errcode = 'P0002';
  end if;

  if v_job.locked_by is distinct from trim(p_device_key)
    or v_job.status not in ('locked'::public.print_job_status, 'printing'::public.print_job_status)
  then
    raise exception 'Print job is not locked by this device'
      using errcode = '23514';
  end if;

  update public.print_jobs
  set
    status = 'printed'::public.print_job_status,
    printed_at = coalesce(printed_at, now())
  where id = v_job.id
  returning * into v_job;

  update public.print_devices
  set last_seen_at = now()
  where device_key = trim(p_device_key);

  return jsonb_build_object(
    'id', v_job.id,
    'status', v_job.status,
    'attemptCount', v_job.attempt_count,
    'printedAt', v_job.printed_at,
    'updatedAt', v_job.updated_at
  );
end;
$$;

create or replace function public.mark_print_job_failed(
  p_print_job_id uuid,
  p_device_key text,
  p_error text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_job public.print_jobs%rowtype;
  v_next_status public.print_job_status;
  v_next_attempt_count smallint;
begin
  select *
  into v_job
  from public.print_jobs
  where id = p_print_job_id
  for update;

  if not found then
    raise exception 'Print job not found'
      using errcode = 'P0002';
  end if;

  if v_job.locked_by is distinct from trim(p_device_key)
    or v_job.status not in ('locked'::public.print_job_status, 'printing'::public.print_job_status)
  then
    raise exception 'Print job is not locked by this device'
      using errcode = '23514';
  end if;

  v_next_attempt_count := v_job.attempt_count + 1;
  v_next_status := case
    when v_next_attempt_count < v_job.max_attempts then 'pending'::public.print_job_status
    else 'failed'::public.print_job_status
  end;

  update public.print_jobs
  set
    attempt_count = v_next_attempt_count,
    status = v_next_status,
    last_error = nullif(trim(p_error), ''),
    locked_at = null,
    locked_by = null
  where id = v_job.id
  returning * into v_job;

  update public.print_devices
  set last_seen_at = now()
  where device_key = trim(p_device_key);

  return jsonb_build_object(
    'id', v_job.id,
    'status', v_job.status,
    'attemptCount', v_job.attempt_count,
    'maxAttempts', v_job.max_attempts,
    'lastError', v_job.last_error,
    'updatedAt', v_job.updated_at
  );
end;
$$;

revoke execute on function public.create_admin_print_job(uuid, public.print_job_type, uuid) from anon;
grant execute on function public.create_admin_print_job(uuid, public.print_job_type, uuid) to authenticated;

revoke execute on function public.retry_admin_print_job(uuid, uuid) from anon;
grant execute on function public.retry_admin_print_job(uuid, uuid) to authenticated;

revoke execute on function public.claim_next_print_job(text, integer) from anon;
grant execute on function public.claim_next_print_job(text, integer) to service_role;

revoke execute on function public.mark_print_job_succeeded(uuid, text) from anon;
grant execute on function public.mark_print_job_succeeded(uuid, text) to service_role;

revoke execute on function public.mark_print_job_failed(uuid, text, text) from anon;
grant execute on function public.mark_print_job_failed(uuid, text, text) to service_role;

grant usage on schema public to authenticated;
grant select on table public.print_devices to authenticated;
grant select, insert, update on table public.print_jobs to authenticated;
grant select on table public.admin_print_job_list to authenticated;

grant usage on schema public to service_role;
grant select on table public.print_devices to service_role;
grant select, update on table public.print_jobs to service_role;
