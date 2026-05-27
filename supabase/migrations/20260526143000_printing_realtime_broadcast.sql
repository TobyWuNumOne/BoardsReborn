create policy "admin profiles can listen to printing broadcasts"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and realtime.topic() like 'printing:%'
  and exists (
    select 1
    from public.admin_profiles
    where id = (select auth.uid())
  )
);

create or replace function public.notify_printing_realtime()
returns trigger
language plpgsql
security definer
set search_path = public, realtime
as $$
declare
  v_row record;
  v_changed_at timestamptz;
  v_entity_id uuid;
  v_event text;
  v_payload jsonb;
  v_source text := tg_table_name;
  v_summary_payload jsonb;
  v_topic text;
begin
  if tg_op = 'DELETE' then
    v_row := old;
  else
    v_row := new;
  end if;

  v_entity_id := v_row.id;
  v_changed_at := coalesce(v_row.updated_at, v_row.created_at, now());

  if tg_table_name = 'print_jobs' then
    v_event := 'print_job.changed';
    v_topic := 'printing:jobs';
    v_payload := jsonb_build_object(
      'eventType', v_event,
      'entityId', v_entity_id,
      'changedAt', v_changed_at,
      'operation', tg_op,
      'source', v_source,
      'jobStatus', v_row.status
    );
  elsif tg_table_name = 'print_devices' then
    v_event := 'print_device.changed';
    v_topic := 'printing:devices';
    v_payload := jsonb_build_object(
      'eventType', v_event,
      'entityId', v_entity_id,
      'changedAt', v_changed_at,
      'operation', tg_op,
      'source', v_source,
      'deviceKey', v_row.device_key
    );
  else
    raise exception 'Unsupported realtime broadcast table: %', tg_table_name;
  end if;

  perform realtime.send(v_payload, v_event, v_topic, true);

  v_summary_payload := jsonb_build_object(
    'eventType', 'printing.summary.changed',
    'entityId', v_entity_id,
    'changedAt', v_changed_at,
    'operation', tg_op,
    'source', v_source
  );

  perform realtime.send(
    v_summary_payload,
    'printing.summary.changed',
    'printing:summary',
    true
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists notify_print_jobs_realtime on public.print_jobs;
create trigger notify_print_jobs_realtime
after insert or update or delete on public.print_jobs
for each row
execute function public.notify_printing_realtime();

drop trigger if exists notify_print_devices_realtime on public.print_devices;
create trigger notify_print_devices_realtime
after insert or update or delete on public.print_devices
for each row
execute function public.notify_printing_realtime();
