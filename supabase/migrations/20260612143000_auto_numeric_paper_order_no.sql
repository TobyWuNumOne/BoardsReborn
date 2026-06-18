set check_function_bodies = off;

create or replace function public.get_next_admin_paper_order_no(
  p_lock boolean default false
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_max_sequence integer;
  v_next_sequence integer;
  v_sequence_label text;
  v_year_suffix text;
begin
  v_year_suffix := to_char(timezone('Asia/Taipei', now()), 'YY');

  if p_lock then
    perform pg_advisory_xact_lock(hashtext('work_order_paper_order_no'), v_year_suffix::integer);
  end if;

  select max(substring(work_orders.paper_order_no from 3)::integer)
  into v_max_sequence
  from public.work_orders
  where work_orders.paper_order_no ~ ('^' || v_year_suffix || '[0-9]+$');

  v_next_sequence := coalesce(v_max_sequence, 0) + 1;
  v_sequence_label := case
    when length(v_next_sequence::text) < 4 then lpad(v_next_sequence::text, 4, '0')
    else v_next_sequence::text
  end;

  return v_year_suffix || v_sequence_label;
end;
$$;

create or replace function public.create_admin_work_order(
  p_customer_mode text,
  p_board jsonb,
  p_work_order jsonb,
  p_quote_items jsonb,
  p_customer_id uuid default null,
  p_customer jsonb default null,
  p_created_by_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  quote_item jsonb;
  v_customer_id uuid;
  v_payment_received boolean;
  v_paper_order_no text;
  v_quote_total_amount integer := 0;
  v_work_order_created_at timestamptz;
  v_work_order_id uuid;
begin
  if p_quote_items is null then
    p_quote_items := '[]'::jsonb;
  end if;

  if jsonb_typeof(p_quote_items) <> 'array' then
    raise exception 'quote_items must be an array'
      using errcode = '23514';
  end if;

  if p_customer_mode = 'create' then
    insert into public.customers (name, phone, note)
    values (
      trim(p_customer ->> 'name'),
      p_customer ->> 'phone',
      nullif(trim(coalesce(p_customer ->> 'note', '')), '')
    )
    returning id into v_customer_id;
  elsif p_customer_mode = 'reuse' then
    select customers.id
    into v_customer_id
    from public.customers
    where customers.id = p_customer_id;

    if v_customer_id is null then
      raise exception 'Customer not found'
        using errcode = 'P0002';
    end if;
  else
    raise exception 'Invalid customer mode'
      using errcode = '23514';
  end if;

  v_paper_order_no := public.get_next_admin_paper_order_no(true);
  v_payment_received := coalesce((p_work_order ->> 'paymentReceived')::boolean, false);

  insert into public.work_orders (
    paper_order_no,
    customer_id,
    board_type,
    board_length_class,
    board_brand,
    board_model,
    board_size_label,
    board_color,
    board_serial_label,
    intake_date,
    damage_description,
    estimated_completion_date,
    current_status,
    payment_received,
    payment_received_at,
    public_note,
    internal_note
  )
  values (
    v_paper_order_no,
    v_customer_id,
    (p_board ->> 'boardType')::public.board_type,
    case
      when nullif(p_board ->> 'boardLengthClass', '') is null then null
      else (p_board ->> 'boardLengthClass')::public.board_length_class
    end,
    nullif(trim(coalesce(p_board ->> 'brand', '')), ''),
    nullif(trim(coalesce(p_board ->> 'model', '')), ''),
    nullif(trim(coalesce(p_board ->> 'sizeLabel', '')), ''),
    nullif(trim(coalesce(p_board ->> 'color', '')), ''),
    nullif(trim(coalesce(p_board ->> 'serialLabel', '')), ''),
    (p_work_order ->> 'intakeDate')::date,
    nullif(trim(coalesce(p_work_order ->> 'damageDescription', '')), ''),
    nullif(p_work_order ->> 'estimatedCompletionDate', '')::date,
    'RECEIVED'::public.work_order_status,
    v_payment_received,
    case when v_payment_received then now() else null end,
    nullif(trim(coalesce(p_work_order ->> 'publicNote', '')), ''),
    nullif(trim(coalesce(p_work_order ->> 'internalNote', '')), '')
  )
  returning id, created_at into v_work_order_id, v_work_order_created_at;

  insert into public.status_history (
    work_order_id,
    status,
    changed_by_user_id
  )
  values (
    v_work_order_id,
    'RECEIVED'::public.work_order_status,
    p_created_by_user_id
  );

  for quote_item in select * from jsonb_array_elements(p_quote_items)
  loop
    insert into public.quote_items (
      work_order_id,
      item_type,
      description,
      amount,
      created_by_user_id
    )
    values (
      v_work_order_id,
      (quote_item ->> 'itemType')::public.quote_item_type,
      trim(quote_item ->> 'description'),
      (quote_item ->> 'amount')::integer,
      p_created_by_user_id
    );

    v_quote_total_amount := v_quote_total_amount + (quote_item ->> 'amount')::integer;
  end loop;

  return jsonb_build_object(
    'id', v_work_order_id,
    'paperOrderNo', v_paper_order_no,
    'currentStatus', 'RECEIVED',
    'quoteTotalAmount', v_quote_total_amount,
    'createdAt', v_work_order_created_at
  );
end;
$$;

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
  where work_orders.id = p_work_order_id;

  if v_paper_order_no is null then
    raise exception 'Work order not found'
      using errcode = 'P0002';
  end if;

  if v_status <> 'RECEIVED'::public.work_order_status then
    raise exception 'Only RECEIVED work orders can be deleted'
      using errcode = '23514';
  end if;

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

revoke execute on function public.get_next_admin_paper_order_no(boolean) from anon;
grant execute on function public.get_next_admin_paper_order_no(boolean) to authenticated;

revoke execute on function public.create_admin_work_order(text, jsonb, jsonb, jsonb, uuid, jsonb, uuid) from anon;
grant execute on function public.create_admin_work_order(text, jsonb, jsonb, jsonb, uuid, jsonb, uuid) to authenticated;

revoke execute on function public.delete_admin_work_order(uuid) from anon;
grant execute on function public.delete_admin_work_order(uuid) to authenticated;
