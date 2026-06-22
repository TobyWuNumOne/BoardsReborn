set check_function_bodies = off;

create or replace function public.enqueue_work_order_received_line_job(
  p_work_order_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_dedupe_key text := 'work_order_received:' || p_work_order_id::text;
  v_job_id uuid;
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

  if not exists (
    select 1
    from public.customer_line_accounts
    where customer_id = v_work_order.customer_id
  ) then
    return jsonb_build_object(
      'enqueued', false,
      'reason', 'NO_ACTIVE_LINE_BINDING'
    );
  end if;

  insert into public.line_jobs (
    customer_id,
    work_order_id,
    job_type,
    dedupe_key,
    payload
  )
  values (
    v_work_order.customer_id,
    p_work_order_id,
    'work_order_received'::public.line_job_type,
    v_dedupe_key,
    jsonb_build_object(
      'workOrderId', p_work_order_id,
      'customerId', v_work_order.customer_id,
      'paperOrderNo', v_work_order.paper_order_no,
      'eventType', 'work_order_received',
      'occurredAt', v_work_order.created_at
    )
  )
  on conflict (dedupe_key) where dedupe_key is not null do nothing
  returning id into v_job_id;

  if v_job_id is null then
    return jsonb_build_object(
      'enqueued', false,
      'reason', 'JOB_ALREADY_EXISTS'
    );
  end if;

  return jsonb_build_object(
    'enqueued', true,
    'jobId', v_job_id
  );
end;
$$;

revoke all on function public.enqueue_work_order_received_line_job(uuid) from public;
grant execute on function public.enqueue_work_order_received_line_job(uuid) to authenticated;
