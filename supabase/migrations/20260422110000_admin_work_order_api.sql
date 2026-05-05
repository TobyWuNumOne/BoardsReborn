set check_function_bodies = off;

create or replace function public.normalize_tw_mobile_phone(raw_phone text)
returns varchar(10)
language plpgsql
immutable
set search_path = public
as $$
declare
  digits text;
begin
  if raw_phone is null then
    return null;
  end if;

  digits := regexp_replace(raw_phone, '[^0-9]', '', 'g');

  if digits ~ '^09[0-9]{8}$' then
    return digits::varchar(10);
  end if;

  if digits ~ '^8869[0-9]{8}$' then
    return ('0' || substring(digits from 4))::varchar(10);
  end if;

  return null;
end;
$$;

alter table public.customers
add column normalized_phone varchar(10)
generated always as (public.normalize_tw_mobile_phone(phone)) stored;

alter table public.customers
add constraint customers_normalized_phone_valid check (normalized_phone is not null);

create index customers_normalized_phone_idx on public.customers (normalized_phone);

create or replace function public.set_customer_phone_normalized()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  normalized varchar(10);
begin
  normalized := public.normalize_tw_mobile_phone(new.phone);

  if normalized is null then
    raise exception 'Invalid Taiwan mobile phone'
      using errcode = '23514';
  end if;

  new.phone := normalized;
  return new;
end;
$$;

create trigger normalize_customers_phone
before insert or update of phone on public.customers
for each row execute function public.set_customer_phone_normalized();

create or replace view public.admin_work_order_list
with (security_invoker = true) as
select
  work_orders.id,
  work_orders.paper_order_no,
  work_orders.customer_id,
  customers.name as customer_name,
  customers.phone as customer_phone,
  customers.normalized_phone as customer_normalized_phone,
  work_orders.board_type,
  work_orders.board_size_label,
  work_orders.current_status,
  work_orders.intake_date,
  work_orders.estimated_completion_date,
  coalesce(quote_totals.quote_total_amount, 0)::integer as quote_total_amount,
  work_orders.payment_received,
  work_orders.payment_received_at,
  work_orders.ready_for_pickup_at,
  work_orders.notified_at,
  work_orders.picked_up_at,
  work_orders.storage_fee_warning_after_days,
  work_orders.created_at,
  work_orders.updated_at,
  latest_received.latest_received_at,
  (
    work_orders.estimated_completion_date is not null
    and work_orders.estimated_completion_date < current_date
    and work_orders.current_status not in (
      'DELIVERED'::public.work_order_status,
      'CANCELLED'::public.work_order_status
    )
  ) as is_overdue_estimated_completion,
  (
    work_orders.notified_at is not null
    and work_orders.picked_up_at is null
    and now() >= work_orders.notified_at + make_interval(days => work_orders.storage_fee_warning_after_days::integer)
  ) as is_pickup_overdue
from public.work_orders
join public.customers on customers.id = work_orders.customer_id
left join (
  select
    quote_items.work_order_id,
    sum(quote_items.amount)::integer as quote_total_amount
  from public.quote_items
  group by quote_items.work_order_id
) as quote_totals on quote_totals.work_order_id = work_orders.id
left join (
  select
    status_history.work_order_id,
    max(status_history.changed_at) as latest_received_at
  from public.status_history
  where status_history.status = 'RECEIVED'::public.work_order_status
  group by status_history.work_order_id
) as latest_received on latest_received.work_order_id = work_orders.id;

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

  v_paper_order_no := trim(p_work_order ->> 'paperOrderNo');
  v_payment_received := coalesce((p_work_order ->> 'paymentReceived')::boolean, false);

  insert into public.work_orders (
    paper_order_no,
    customer_id,
    board_type,
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

revoke execute on function public.create_admin_work_order(text, jsonb, jsonb, jsonb, uuid, jsonb, uuid) from anon;
grant execute on function public.create_admin_work_order(text, jsonb, jsonb, jsonb, uuid, jsonb, uuid) to authenticated;
