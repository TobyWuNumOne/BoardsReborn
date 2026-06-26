-- record_line_job_result marks READY jobs as sent and maintains work_orders.notified_at.
-- Postgres requires UPDATE privilege on work_orders for that side effect.
grant update on table public.work_orders to service_role;
