set check_function_bodies = off;

create or replace function public.transition_admin_work_order_status(
  p_work_order_id uuid,
  p_status public.work_order_status,
  p_note text default null,
  p_internal_note text default null,
  p_internal_note_is_set boolean default false,
  p_changed_by_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_cancelled_at timestamptz;
  v_changed_at timestamptz;
  v_delivered_at timestamptz;
  v_internal_note text;
  v_line_job_id uuid;
  v_line_notification jsonb;
  v_note text;
  v_ready_dedupe_key text := 'work_order_ready_for_pickup:' || p_work_order_id::text;
  v_ready_for_pickup_at timestamptz;
  v_status_history_id uuid;
  v_transitioned_at timestamptz := now();
  v_updated_at timestamptz;
  v_work_order public.work_orders%rowtype;
begin
  v_note := nullif(trim(coalesce(p_note, '')), '');
  v_internal_note := nullif(trim(coalesce(p_internal_note, '')), '');

  select *
  into v_work_order
  from public.work_orders
  where id = p_work_order_id
  for update;

  if not found then
    raise exception 'Work order not found'
      using errcode = 'P0002';
  end if;

  if v_work_order.board_type = 'SNOWBOARD'::public.board_type
    and p_status = 'DRYING'::public.work_order_status
  then
    raise exception 'SNOWBOARD work orders cannot enter DRYING'
      using errcode = '23514';
  end if;

  insert into public.status_history (
    work_order_id,
    status,
    changed_by_user_id,
    note
  )
  values (
    p_work_order_id,
    p_status,
    p_changed_by_user_id,
    v_note
  )
  returning id, changed_at into v_status_history_id, v_changed_at;

  update public.work_orders
  set
    current_status = p_status,
    internal_note = case
      when p_internal_note_is_set then v_internal_note
      else internal_note
    end,
    ready_for_pickup_at = case
      when p_status = 'READY_FOR_PICKUP'::public.work_order_status
        then coalesce(ready_for_pickup_at, v_transitioned_at)
      else ready_for_pickup_at
    end,
    delivered_at = case
      when p_status = 'DELIVERED'::public.work_order_status
        then coalesce(delivered_at, v_transitioned_at)
      else delivered_at
    end,
    picked_up_at = case
      when p_status = 'DELIVERED'::public.work_order_status
        then coalesce(picked_up_at, v_transitioned_at)
      else picked_up_at
    end,
    cancelled_at = case
      when p_status = 'CANCELLED'::public.work_order_status
        then coalesce(cancelled_at, v_transitioned_at)
      else cancelled_at
    end
  where id = p_work_order_id
  returning ready_for_pickup_at, delivered_at, cancelled_at, updated_at
  into v_ready_for_pickup_at, v_delivered_at, v_cancelled_at, v_updated_at;

  if p_status <> 'READY_FOR_PICKUP'::public.work_order_status then
    v_line_notification := jsonb_build_object(
      'enqueued', false,
      'reason', 'NOT_READY_FOR_PICKUP'
    );
  elsif not exists (
    select 1
    from public.customer_line_accounts
    where customer_id = v_work_order.customer_id
  ) then
    v_line_notification := jsonb_build_object(
      'enqueued', false,
      'reason', 'NO_ACTIVE_LINE_BINDING'
    );
  elsif v_work_order.notified_at is not null then
    v_line_notification := jsonb_build_object(
      'enqueued', false,
      'reason', 'ALREADY_NOTIFIED'
    );
  else
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
      'work_order_ready_for_pickup'::public.line_job_type,
      v_ready_dedupe_key,
      jsonb_build_object(
        'workOrderId', p_work_order_id,
        'customerId', v_work_order.customer_id,
        'paperOrderNo', v_work_order.paper_order_no,
        'status', p_status,
        'eventType', 'work_order_ready_for_pickup',
        'occurredAt', v_changed_at
      )
    )
    on conflict (dedupe_key) where dedupe_key is not null do nothing
    returning id into v_line_job_id;

    if v_line_job_id is null then
      v_line_notification := jsonb_build_object(
        'enqueued', false,
        'reason', 'JOB_ALREADY_EXISTS'
      );
    else
      v_line_notification := jsonb_build_object(
        'enqueued', true,
        'jobId', v_line_job_id
      );
    end if;
  end if;

  return jsonb_build_object(
    'workOrder',
    jsonb_build_object(
      'id', p_work_order_id,
      'paperOrderNo', v_work_order.paper_order_no,
      'currentStatus', p_status,
      'readyForPickupAt', v_ready_for_pickup_at,
      'deliveredAt', v_delivered_at,
      'cancelledAt', v_cancelled_at,
      'updatedAt', v_updated_at
    ),
    'statusHistory',
    jsonb_build_object(
      'id', v_status_history_id,
      'status', p_status,
      'changedAt', v_changed_at,
      'note', v_note
    ),
    'lineNotification', v_line_notification
  );
end;
$$;

revoke execute on function public.transition_admin_work_order_status(
  uuid,
  public.work_order_status,
  text,
  text,
  boolean,
  uuid
) from anon;

grant execute on function public.transition_admin_work_order_status(
  uuid,
  public.work_order_status,
  text,
  text,
  boolean,
  uuid
) to authenticated;
