create policy "admin profiles can join printing broadcast topics"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension = 'broadcast'
  and realtime.topic() like 'printing:%'
  and exists (
    select 1
    from public.admin_profiles
    where id = (select auth.uid())
  )
);
