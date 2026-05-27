drop trigger if exists notify_print_jobs_realtime on public.print_jobs;
drop trigger if exists notify_print_devices_realtime on public.print_devices;
drop function if exists public.notify_printing_realtime();

create or replace function public.emit_printing_realtime_event(
  p_payload jsonb,
  p_event text,
  p_topic text,
  p_is_private boolean default true
)
returns void
language plpgsql
security definer
set search_path = public, realtime
as $$
begin
  perform realtime.send(p_payload, p_event, p_topic, p_is_private);
end;
$$;

revoke execute on function public.emit_printing_realtime_event(jsonb, text, text, boolean) from anon;
grant execute on function public.emit_printing_realtime_event(jsonb, text, text, boolean) to authenticated;
grant execute on function public.emit_printing_realtime_event(jsonb, text, text, boolean) to service_role;
