create or replace function public.delete_admin_work_order(
  p_work_order_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_deleted_at timestamptz := now();
  v_paper_order_no text;
  v_status public.work_order_status;
begin
  select work_orders.paper_order_no, work_orders.current_status
  into v_paper_order_no, v_status
  from public.work_orders
  where work_orders.id = p_work_order_id
  for update;

  if v_paper_order_no is null then
    raise exception 'Work order not found'
      using errcode = 'P0002';
  end if;

  if v_status <> 'RECEIVED'::public.work_order_status then
    raise exception 'Only RECEIVED work orders can be deleted'
      using errcode = '23514';
  end if;

  perform 1
  from public.print_jobs
  where print_jobs.work_order_id = p_work_order_id
  for update;

  if exists (
    select 1
    from public.print_jobs
    where print_jobs.work_order_id = p_work_order_id
      and print_jobs.status in (
        'locked'::public.print_job_status,
        'printing'::public.print_job_status,
        'printed'::public.print_job_status
      )
  ) then
    raise exception 'Work order has active or printed print jobs'
      using errcode = '23514';
  end if;

  delete from public.work_orders
  where work_orders.id = p_work_order_id;

  return jsonb_build_object(
    'id', p_work_order_id,
    'paperOrderNo', v_paper_order_no,
    'deletedAt', v_deleted_at
  );
end;
$$;
