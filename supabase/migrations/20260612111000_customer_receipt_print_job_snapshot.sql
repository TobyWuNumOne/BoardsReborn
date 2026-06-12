drop function if exists public.create_admin_print_job(uuid, public.print_job_type, uuid);

create or replace function public.create_admin_print_job(
  p_work_order_id uuid,
  p_job_type public.print_job_type default 'work_order_label',
  p_created_by_user_id uuid default auth.uid(),
  p_public_lookup_url text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_barcode_value text;
  v_board_type_label text;
  v_customer_phone varchar(32);
  v_display_order_number text;
  v_job public.print_jobs%rowtype;
  v_job_type public.print_job_type := coalesce(p_job_type, 'work_order_label'::public.print_job_type);
  v_payload jsonb;
  v_print_phone text;
  v_public_lookup_url text;
  v_repair_count smallint;
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

  select phone
  into v_customer_phone
  from public.customers
  where id = v_work_order.customer_id;

  v_repair_count := v_work_order.repair_count;

  if v_repair_count is null then
    raise exception 'Print repair count is required'
      using errcode = '23514';
  end if;

  v_print_phone := public.build_print_phone_value(v_customer_phone);
  v_barcode_value := public.build_print_barcode_value(v_work_order.paper_order_no);
  v_display_order_number := v_barcode_value;
  v_public_lookup_url := nullif(trim(coalesce(p_public_lookup_url, '')), '');
  v_board_type_label := case v_work_order.board_type
    when 'SURFBOARD'::public.board_type then '衝浪板'
    when 'SUP'::public.board_type then 'SUP'
    when 'SNOWBOARD'::public.board_type then '雪板'
    else v_work_order.board_type::text
  end;

  if v_print_phone is null then
    raise exception 'Print phone value is invalid'
      using errcode = '23514';
  end if;

  if v_job_type = 'work_order_label'::public.print_job_type then
    if v_barcode_value is null
      or length(v_barcode_value) < 4
      or length(v_barcode_value) > 32
      or v_barcode_value !~ '^[A-Z0-9]+$'
    then
      raise exception 'Print barcode value is invalid'
        using errcode = '23514';
    end if;

    v_payload := jsonb_build_object(
      'templateVersion', 2,
      'paperOrderNo', v_work_order.paper_order_no,
      'displayOrderNumber', v_display_order_number,
      'barcodeValue', v_barcode_value,
      'intakeDate', v_work_order.intake_date,
      'customerPhone', v_print_phone,
      'paymentReceived', v_work_order.payment_received,
      'repairCount', v_repair_count
    );
  elsif v_job_type = 'customer_receipt'::public.print_job_type then
    if v_public_lookup_url is null then
      raise exception 'Print public lookup URL is required'
        using errcode = '23514';
    end if;

    v_payload := jsonb_build_object(
      'templateVersion', 1,
      'paperOrderNo', v_work_order.paper_order_no,
      'intakeDate', v_work_order.intake_date,
      'customerPhone', v_print_phone,
      'boardTypeLabel', v_board_type_label,
      'repairCount', v_repair_count,
      'paymentReceived', v_work_order.payment_received,
      'publicLookupUrl', v_public_lookup_url
    );
  else
    raise exception 'Print job type is unsupported'
      using errcode = '23514';
  end if;

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
    v_job_type,
    'pending'::public.print_job_status,
    v_payload,
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

revoke execute on function public.create_admin_print_job(uuid, public.print_job_type, uuid, text) from anon;
grant execute on function public.create_admin_print_job(uuid, public.print_job_type, uuid, text) to authenticated;
