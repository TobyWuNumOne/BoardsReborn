alter type public.line_job_status rename value 'processing' to 'locked';
alter type public.line_job_skip_reason add value if not exists 'recipient_binding_changed';

alter table public.line_jobs
drop constraint line_jobs_lock_consistent,
drop constraint line_jobs_success_consistent;

alter table public.line_jobs
add column prepared_messages jsonb,
add column first_attempt_at timestamptz;

alter table public.line_jobs
add constraint line_jobs_prepared_messages_array
  check (prepared_messages is null or jsonb_typeof(prepared_messages) = 'array'),
add constraint line_jobs_lock_consistent check (
  (status = 'locked' and locked_at is not null and locked_by is not null)
  or (status <> 'locked' and locked_at is null and locked_by is null)
),
add constraint line_jobs_prepared_consistent check (
  (recipient_line_user_id is null and prepared_messages is null and retry_key is null and first_attempt_at is null)
  or (
    recipient_line_user_id is not null
    and prepared_messages is not null
    and retry_key is not null
    and first_attempt_at is not null
  )
),
add constraint line_jobs_success_consistent check (
  status <> 'succeeded'
  or (sent_at is not null and recipient_line_user_id is not null
      and prepared_messages is not null and retry_key is not null)
);

drop index if exists public.line_jobs_processing_reclaim_idx;
create index line_jobs_locked_reclaim_idx on public.line_jobs (locked_at)
where status = 'locked';

create or replace function public.claim_line_jobs(
  p_locked_by text,
  p_batch_size integer default 20,
  p_stale_lock_seconds integer default 300
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_jobs jsonb;
begin
  if nullif(trim(p_locked_by), '') is null then
    raise exception 'Processor lock owner is required' using errcode = '23514';
  end if;
  if p_batch_size < 1 or p_batch_size > 20 then
    raise exception 'Processor batch size is invalid' using errcode = '23514';
  end if;

  with candidates as (
    select id
    from public.line_jobs
    where (
      status = 'pending' and available_at <= statement_timestamp()
    ) or (
      status = 'locked'
      and locked_at <= statement_timestamp() - make_interval(secs => p_stale_lock_seconds)
    )
    order by available_at, created_at
    for update skip locked
    limit p_batch_size
  ), claimed as (
    update public.line_jobs
    set status = 'locked', locked_at = statement_timestamp(), locked_by = p_locked_by
    where id in (select id from candidates)
    returning id, customer_id, work_order_id, job_type, attempts, max_attempts,
      recipient_line_user_id, prepared_messages, retry_key, first_attempt_at, created_at
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'customerId', customer_id,
    'workOrderId', work_order_id,
    'jobType', job_type,
    'attempts', attempts,
    'maxAttempts', max_attempts,
    'recipient', recipient_line_user_id,
    'messages', prepared_messages,
    'retryKey', retry_key,
    'firstAttemptAt', first_attempt_at,
    'createdAt', created_at
  )), '[]'::jsonb) into v_jobs from claimed;

  return jsonb_build_object('jobs', v_jobs);
end;
$$;

create or replace function public.prepare_line_job(
  p_job_id uuid,
  p_locked_by text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_job public.line_jobs%rowtype;
  v_binding public.customer_line_accounts%rowtype;
  v_messages jsonb;
  v_now timestamptz := statement_timestamp();
  v_paper_order_no text;
begin
  select * into v_job from public.line_jobs where id = p_job_id for update;
  if not found or v_job.status <> 'locked' or v_job.locked_by <> p_locked_by then
    raise exception 'LINE job is not claimed by this processor' using errcode = '55000';
  end if;

  select * into v_binding
  from public.customer_line_accounts
  where customer_id = v_job.customer_id;

  if v_binding.id is null then
    if v_job.recipient_line_user_id is null then
      update public.line_jobs set status = 'skipped', skip_reason = 'no_active_line_binding',
        locked_at = null, locked_by = null where id = v_job.id;
      return jsonb_build_object('outcome', 'skipped', 'reason', 'no_active_line_binding');
    else
      update public.line_jobs set status = 'skipped', skip_reason = 'recipient_binding_changed',
        locked_at = null, locked_by = null where id = v_job.id;
      return jsonb_build_object('outcome', 'skipped', 'reason', 'recipient_binding_changed');
    end if;
  elsif v_job.recipient_line_user_id is not null
    and v_binding.line_user_id <> v_job.recipient_line_user_id
  then
    update public.line_jobs set status = 'skipped', skip_reason = 'recipient_binding_changed',
      locked_at = null, locked_by = null where id = v_job.id;
    return jsonb_build_object('outcome', 'skipped', 'reason', 'recipient_binding_changed');
  end if;

  if v_binding.friendship_checked_at is not null
    and (not v_binding.is_friend or v_binding.blocked_at is not null)
  then
    update public.line_jobs set status = 'skipped', skip_reason = 'line_not_notifyable',
      locked_at = null, locked_by = null where id = v_job.id;
    return jsonb_build_object('outcome', 'skipped', 'reason', 'line_not_notifyable');
  end if;

  if v_job.attempts >= v_job.max_attempts
    or (v_job.first_attempt_at is not null and v_job.first_attempt_at + interval '24 hours' <= v_now)
  then
    update public.line_jobs set status = 'failed', last_error = 'retry_window_exhausted',
      locked_at = null, locked_by = null where id = v_job.id;
    return jsonb_build_object('outcome', 'failed');
  end if;

  if v_job.prepared_messages is null then
    select paper_order_no into v_paper_order_no
    from public.work_orders where id = v_job.work_order_id;
    v_messages := jsonb_build_array(jsonb_build_object(
      'type', 'text',
      'text', case v_job.job_type
        when 'line_binding_success' then 'LINE 通知綁定成功。工單：' || coalesce(v_paper_order_no, '—')
        when 'work_order_received' then '維修工單已收件。工單：' || coalesce(v_paper_order_no, '—')
        when 'work_order_ready_for_pickup' then '維修已完成，請聯絡店家安排取件。工單：' || coalesce(v_paper_order_no, '—')
      end
    ));

    update public.line_jobs set
      recipient_line_user_id = v_binding.line_user_id,
      prepared_messages = v_messages,
      retry_key = extensions.gen_random_uuid(),
      first_attempt_at = v_now,
      attempts = attempts + 1
    where id = v_job.id
    returning * into v_job;
  else
    update public.line_jobs set attempts = attempts + 1
    where id = v_job.id returning * into v_job;
  end if;

  return jsonb_build_object(
    'outcome', 'ready',
    'recipient', v_job.recipient_line_user_id,
    'messages', v_job.prepared_messages,
    'retryKey', v_job.retry_key,
    'attempts', v_job.attempts
  );
end;
$$;

create or replace function public.record_line_job_result(
  p_job_id uuid,
  p_locked_by text,
  p_result text,
  p_error text default null,
  p_available_at timestamptz default null,
  p_sent_at timestamptz default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_job public.line_jobs%rowtype;
  v_sent_at timestamptz := coalesce(p_sent_at, statement_timestamp());
begin
  select * into v_job from public.line_jobs where id = p_job_id for update;
  if not found or v_job.status <> 'locked' or v_job.locked_by <> p_locked_by then
    raise exception 'LINE job is not claimed by this processor' using errcode = '55000';
  end if;

  if p_result = 'succeeded' then
    update public.line_jobs set status = 'succeeded', sent_at = v_sent_at,
      last_error = null, locked_at = null, locked_by = null
    where id = v_job.id returning * into v_job;

    if v_job.job_type = 'work_order_ready_for_pickup' and v_job.work_order_id is not null then
      update public.work_orders
      set notified_at = coalesce(work_orders.notified_at, v_sent_at)
      where id = v_job.work_order_id;
    end if;
    return jsonb_build_object('outcome', 'succeeded');
  end if;

  if p_result = 'retry' and v_job.attempts < v_job.max_attempts
    and v_job.first_attempt_at + interval '24 hours' > statement_timestamp()
  then
    update public.line_jobs set status = 'pending', available_at = coalesce(p_available_at, statement_timestamp() + interval '1 minute'),
      last_error = left(coalesce(p_error, 'retryable_line_error'), 1000), locked_at = null, locked_by = null
    where id = v_job.id;
    return jsonb_build_object('outcome', 'retried');
  end if;

  update public.line_jobs set status = 'failed',
    last_error = left(coalesce(p_error, 'line_request_failed'), 1000), locked_at = null, locked_by = null
  where id = v_job.id;
  return jsonb_build_object('outcome', 'failed');
end;
$$;

revoke all on function public.claim_line_jobs(text, integer, integer) from public;
revoke all on function public.prepare_line_job(uuid, text) from public;
revoke all on function public.record_line_job_result(uuid, text, text, text, timestamptz, timestamptz) from public;
grant execute on function public.claim_line_jobs(text, integer, integer) to service_role;
grant execute on function public.prepare_line_job(uuid, text) to service_role;
grant execute on function public.record_line_job_result(uuid, text, text, text, timestamptz, timestamptz) to service_role;
