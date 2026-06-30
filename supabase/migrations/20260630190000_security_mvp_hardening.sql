create table if not exists public.public_rate_limits (
  rate_limit_key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_rate_limits_key_not_blank check (length(trim(rate_limit_key)) > 0),
  constraint public_rate_limits_count_non_negative check (count >= 0)
);

create index if not exists public_rate_limits_reset_at_idx
on public.public_rate_limits (reset_at);

create trigger set_public_rate_limits_updated_at
before update on public.public_rate_limits
for each row execute function public.set_updated_at();

alter table public.public_rate_limits enable row level security;

revoke all on table public.public_rate_limits from anon;
revoke all on table public.public_rate_limits from authenticated;
grant select, insert, update, delete on table public.public_rate_limits to service_role;

create or replace function public.check_public_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
  v_now timestamptz := now();
  v_reset_at timestamptz;
begin
  if length(trim(coalesce(p_key, ''))) = 0 then
    raise exception 'Rate limit key is required'
      using errcode = '23514';
  end if;

  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Rate limit configuration is invalid'
      using errcode = '23514';
  end if;

  insert into public.public_rate_limits as rate_limits (
    rate_limit_key,
    count,
    reset_at
  )
  values (
    trim(p_key),
    1,
    v_now + make_interval(secs => p_window_seconds)
  )
  on conflict (rate_limit_key) do update
  set
    count = case
      when rate_limits.reset_at <= v_now then 1
      else rate_limits.count + 1
    end,
    reset_at = case
      when rate_limits.reset_at <= v_now then v_now + make_interval(secs => p_window_seconds)
      else rate_limits.reset_at
    end
  where rate_limits.reset_at <= v_now or rate_limits.count < p_limit
  returning public_rate_limits.count, public_rate_limits.reset_at
  into v_count, v_reset_at;

  if found then
    return jsonb_build_object(
      'allowed', true,
      'remaining', greatest(p_limit - v_count, 0),
      'resetAt', v_reset_at
    );
  end if;

  select count, reset_at
  into v_count, v_reset_at
  from public.public_rate_limits
  where rate_limit_key = trim(p_key);

  return jsonb_build_object(
    'allowed', false,
    'remaining', 0,
    'resetAt', v_reset_at
  );
end;
$$;

revoke all on function public.check_public_rate_limit(text, integer, integer) from public;
grant execute on function public.check_public_rate_limit(text, integer, integer) to service_role;

drop policy if exists "Authenticated users can manage admin profiles" on public.admin_profiles;
drop policy if exists "Authenticated users can manage customers" on public.customers;
drop policy if exists "Authenticated users can manage work orders" on public.work_orders;
drop policy if exists "Authenticated users can manage status history" on public.status_history;
drop policy if exists "Authenticated users can manage photos" on public.photos;
drop policy if exists "Authenticated users can manage quote items" on public.quote_items;
drop policy if exists "Authenticated users can manage print jobs" on public.print_jobs;
drop policy if exists "Authenticated users can manage work order repair marks" on public.work_order_repair_marks;
drop policy if exists "Authenticated users can manage print devices" on public.print_devices;
drop policy if exists "Authenticated users can manage repair photos" on storage.objects;

revoke insert, update, delete on table public.admin_profiles from authenticated;

create policy "Admins can read own admin profile"
on public.admin_profiles
for select
to authenticated
using (id = (select auth.uid()));

create policy "Admins can manage customers"
on public.customers
for all
to authenticated
using (
  exists (
    select 1
    from public.admin_profiles
    where admin_profiles.id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.admin_profiles
    where admin_profiles.id = (select auth.uid())
  )
);

create policy "Admins can manage work orders"
on public.work_orders
for all
to authenticated
using (
  exists (
    select 1
    from public.admin_profiles
    where admin_profiles.id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.admin_profiles
    where admin_profiles.id = (select auth.uid())
  )
);

create policy "Admins can manage status history"
on public.status_history
for all
to authenticated
using (
  exists (
    select 1
    from public.admin_profiles
    where admin_profiles.id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.admin_profiles
    where admin_profiles.id = (select auth.uid())
  )
);

create policy "Admins can manage photos"
on public.photos
for all
to authenticated
using (
  exists (
    select 1
    from public.admin_profiles
    where admin_profiles.id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.admin_profiles
    where admin_profiles.id = (select auth.uid())
  )
);

create policy "Admins can manage quote items"
on public.quote_items
for all
to authenticated
using (
  exists (
    select 1
    from public.admin_profiles
    where admin_profiles.id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.admin_profiles
    where admin_profiles.id = (select auth.uid())
  )
);

create policy "Admins can manage print jobs"
on public.print_jobs
for all
to authenticated
using (
  exists (
    select 1
    from public.admin_profiles
    where admin_profiles.id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.admin_profiles
    where admin_profiles.id = (select auth.uid())
  )
);

create policy "Admins can manage work order repair marks"
on public.work_order_repair_marks
for all
to authenticated
using (
  exists (
    select 1
    from public.admin_profiles
    where admin_profiles.id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.admin_profiles
    where admin_profiles.id = (select auth.uid())
  )
);

create policy "Admins can manage print devices"
on public.print_devices
for all
to authenticated
using (
  exists (
    select 1
    from public.admin_profiles
    where admin_profiles.id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.admin_profiles
    where admin_profiles.id = (select auth.uid())
  )
);

create policy "Admins can manage repair photos"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'repair-photos'
  and exists (
    select 1
    from public.admin_profiles
    where admin_profiles.id = (select auth.uid())
  )
)
with check (
  bucket_id = 'repair-photos'
  and exists (
    select 1
    from public.admin_profiles
    where admin_profiles.id = (select auth.uid())
  )
);
