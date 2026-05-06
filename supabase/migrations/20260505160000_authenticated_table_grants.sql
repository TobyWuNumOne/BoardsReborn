grant usage on schema public to authenticated;

grant select, insert, update, delete on table
  public.admin_profiles,
  public.customers,
  public.work_orders,
  public.status_history,
  public.photos,
  public.quote_items,
  public.print_jobs
to authenticated;

grant select on table public.admin_work_order_list to authenticated;
