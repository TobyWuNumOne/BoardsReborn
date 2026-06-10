set check_function_bodies = off;

drop view if exists public.admin_work_order_list;

create view public.admin_work_order_list
with (security_invoker = true) as
select
  work_orders.id,
  work_orders.paper_order_no,
  work_orders.customer_id,
  customers.name as customer_name,
  customers.phone as customer_phone,
  customers.normalized_phone as customer_normalized_phone,
  work_orders.board_type,
  work_orders.board_length_class,
  work_orders.board_size_label,
  work_orders.board_color,
  work_orders.current_status,
  work_orders.intake_date,
  work_orders.estimated_completion_date,
  work_orders.repair_count,
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
