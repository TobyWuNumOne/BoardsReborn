create or replace view public.admin_customer_list as
select
  customers.id,
  customers.name,
  customers.phone,
  customers.normalized_phone,
  customers.note,
  customers.created_at,
  customers.updated_at,
  count(work_orders.id)::integer as work_order_count,
  count(work_orders.id) filter (
    where work_orders.current_status not in (
      'DELIVERED'::public.work_order_status,
      'CANCELLED'::public.work_order_status
    )
  )::integer as active_work_order_count,
  latest_work_order.id as latest_work_order_id,
  latest_work_order.paper_order_no as latest_paper_order_no,
  latest_work_order.current_status as latest_work_order_status,
  latest_work_order.updated_at as latest_work_order_updated_at,
  customer_line_accounts.id is not null as line_linked,
  customer_line_accounts.display_name as line_display_name,
  customer_line_accounts.picture_url as line_picture_url,
  customer_line_accounts.is_friend as line_is_friend,
  customer_line_accounts.blocked_at as line_blocked_at,
  customer_line_accounts.friendship_checked_at as line_friendship_checked_at,
  case
    when customer_line_accounts.id is null then 'unlinked'
    when customer_line_accounts.blocked_at is not null then 'not_notifyable'
    when customer_line_accounts.friendship_checked_at is not null
      and customer_line_accounts.is_friend is false then 'not_notifyable'
    when customer_line_accounts.is_friend is true then 'notifyable'
    else 'unknown'
  end as line_notify_status
from public.customers
left join public.work_orders on work_orders.customer_id = customers.id
left join lateral (
  select id, paper_order_no, current_status, updated_at
  from public.work_orders latest_work_order
  where latest_work_order.customer_id = customers.id
  order by latest_work_order.updated_at desc
  limit 1
) as latest_work_order on true
left join public.customer_line_accounts on customer_line_accounts.customer_id = customers.id
group by
  customers.id,
  customer_line_accounts.id,
  latest_work_order.id,
  latest_work_order.paper_order_no,
  latest_work_order.current_status,
  latest_work_order.updated_at;

grant select on table public.admin_customer_list to authenticated;

create or replace function public.transfer_admin_work_order_customer(
  p_work_order_id uuid,
  p_target_customer_id uuid
)
returns table(
  work_order_id uuid,
  previous_customer_id uuid,
  target_customer_id uuid,
  transferred_at timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_previous_customer_id uuid;
begin
  select work_orders.customer_id
  into v_previous_customer_id
  from public.work_orders
  where work_orders.id = p_work_order_id
  for update;

  if not found then
    raise exception 'Work order not found'
      using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.customers
    where customers.id = p_target_customer_id
  ) then
    raise exception 'Target customer not found'
      using errcode = 'P0002';
  end if;

  if v_previous_customer_id = p_target_customer_id then
    raise exception 'Target customer must be different'
      using errcode = '23514';
  end if;

  update public.work_orders
  set
    customer_id = p_target_customer_id,
    updated_at = now()
  where id = p_work_order_id;

  return query
  select
    p_work_order_id,
    v_previous_customer_id,
    p_target_customer_id,
    statement_timestamp();
end;
$$;

grant execute on function public.transfer_admin_work_order_customer(uuid, uuid) to authenticated;
