create or replace view public.admin_print_device_list
with (security_invoker = true) as
select
  print_devices.id,
  print_devices.name,
  print_devices.device_key,
  print_devices.location,
  print_devices.status,
  print_devices.last_seen_at,
  print_devices.created_at,
  print_devices.updated_at,
  current_job.job_id as current_job_id,
  current_job.work_order_id as current_job_work_order_id,
  current_job.paper_order_no as current_job_paper_order_no,
  current_job.status as current_job_status,
  current_job.locked_at as current_job_locked_at,
  recent_error.job_id as recent_error_job_id,
  recent_error.last_error as recent_error_message,
  recent_error.updated_at as recent_error_updated_at,
  concat_ws(
    ' ',
    print_devices.name,
    print_devices.device_key,
    coalesce(print_devices.location, '')
  ) as search_text
from public.print_devices
left join lateral (
  select
    print_jobs.id as job_id,
    print_jobs.work_order_id,
    work_orders.paper_order_no,
    print_jobs.status,
    print_jobs.locked_at
  from public.print_jobs
  join public.work_orders on work_orders.id = print_jobs.work_order_id
  where print_jobs.print_device_id = print_devices.id
    and print_jobs.status in ('locked'::public.print_job_status, 'printing'::public.print_job_status)
  order by coalesce(print_jobs.locked_at, print_jobs.updated_at) desc
  limit 1
) as current_job on true
left join lateral (
  select
    print_jobs.id as job_id,
    print_jobs.last_error,
    print_jobs.updated_at
  from public.print_jobs
  where print_jobs.print_device_id = print_devices.id
    and print_jobs.last_error is not null
  order by print_jobs.updated_at desc
  limit 1
) as recent_error on true;

grant select on table public.admin_print_device_list to authenticated;
