create or replace function public.to_printable_ascii(p_value text)
returns text
language sql
immutable
as $$
  select nullif(trim(regexp_replace(coalesce(p_value, ''), '[^ -~]', '', 'g')), '');
$$;

create or replace function public.mask_print_phone(p_value text)
returns text
language sql
immutable
as $$
  with digits as (
    select regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g') as value
  )
  select
    case
      when length(value) >= 4 then '****' || right(value, 4)
      else null
    end
  from digits;
$$;

create or replace function public.build_print_barcode_value(p_value text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(upper(coalesce(p_value, '')), '[^A-Z0-9]', '', 'g'), '');
$$;

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
  v_barcode_value text;
  v_board_type text;
  v_customer_name_ascii text;
  v_customer_phone varchar(32);
  v_job public.print_jobs%rowtype;
  v_masked_phone text;
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

  select
    public.to_printable_ascii(name),
    phone
  into
    v_customer_name_ascii,
    v_customer_phone
  from public.customers
  where id = v_work_order.customer_id;

  v_masked_phone := public.mask_print_phone(v_customer_phone);
  v_board_type := public.to_printable_ascii(v_work_order.board_type::text);
  v_barcode_value := public.build_print_barcode_value(v_work_order.paper_order_no);

  if v_barcode_value is null
    or length(v_barcode_value) < 4
    or length(v_barcode_value) > 32
    or v_barcode_value !~ '^[A-Z0-9]+$'
  then
    raise exception 'Print barcode value is invalid'
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
    p_job_type,
    'pending'::public.print_job_status,
    jsonb_build_object(
      'templateVersion', 1,
      'paperOrderNo', v_work_order.paper_order_no,
      'barcodeValue', v_barcode_value,
      'customerNameAscii', v_customer_name_ascii,
      'maskedPhone', v_masked_phone,
      'boardType', v_board_type
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

revoke execute on function public.to_printable_ascii(text) from public;
grant execute on function public.to_printable_ascii(text) to authenticated;

revoke execute on function public.mask_print_phone(text) from public;
grant execute on function public.mask_print_phone(text) to authenticated;

revoke execute on function public.build_print_barcode_value(text) from public;
grant execute on function public.build_print_barcode_value(text) to authenticated;

revoke execute on function public.create_admin_print_job(uuid, public.print_job_type, uuid) from anon;
grant execute on function public.create_admin_print_job(uuid, public.print_job_type, uuid) to authenticated;
