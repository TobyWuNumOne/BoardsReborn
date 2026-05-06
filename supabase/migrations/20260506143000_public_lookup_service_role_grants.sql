grant usage on schema public to service_role;

grant select on table
  public.customers,
  public.work_orders,
  public.quote_items
to service_role;
