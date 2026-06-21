create type public.line_job_type as enum (
  'line_binding_success',
  'work_order_received',
  'work_order_ready_for_pickup'
);

create type public.line_job_status as enum (
  'pending',
  'processing',
  'succeeded',
  'failed',
  'skipped'
);

create type public.line_job_skip_reason as enum (
  'no_active_line_binding',
  'line_not_notifyable'
);

alter table public.work_orders
add constraint work_orders_id_customer_id_key unique (id, customer_id);

create table public.customer_line_accounts (
  id uuid primary key default extensions.gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  line_user_id varchar(128) not null,
  display_name varchar(120),
  picture_url text,
  linked_at timestamptz not null default now(),
  last_seen_at timestamptz,
  is_friend boolean not null default false,
  blocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_line_accounts_customer_id_key unique (customer_id),
  constraint customer_line_accounts_line_user_id_key unique (line_user_id),
  constraint customer_line_accounts_line_user_id_not_blank
    check (length(trim(line_user_id)) > 0),
  constraint customer_line_accounts_friend_blocked_consistent
    check (not is_friend or blocked_at is null),
  constraint customer_line_accounts_timestamps_valid
    check (
      linked_at >= created_at
      and (last_seen_at is null or last_seen_at >= created_at)
      and (blocked_at is null or blocked_at >= created_at)
    )
);

create table public.line_bind_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  token_hash text not null,
  customer_id uuid not null references public.customers (id) on delete cascade,
  work_order_id uuid not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint line_bind_tokens_token_hash_key unique (token_hash),
  constraint line_bind_tokens_work_order_customer_fk
    foreign key (work_order_id, customer_id)
    references public.work_orders (id, customer_id)
    on update cascade
    on delete cascade,
  constraint line_bind_tokens_token_hash_not_blank check (length(trim(token_hash)) > 0),
  constraint line_bind_tokens_expires_after_creation check (expires_at > created_at),
  constraint line_bind_tokens_used_or_revoked check (used_at is null or revoked_at is null),
  constraint line_bind_tokens_terminal_timestamps_valid check (
    (used_at is null or used_at >= created_at)
    and (revoked_at is null or revoked_at >= created_at)
  )
);

create table public.line_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete restrict,
  work_order_id uuid,
  job_type public.line_job_type not null,
  status public.line_job_status not null default 'pending',
  dedupe_key varchar(200),
  recipient_line_user_id varchar(128),
  payload jsonb,
  retry_key uuid,
  attempts smallint not null default 0,
  max_attempts smallint not null default 3,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by varchar(120),
  last_error text,
  skip_reason public.line_job_skip_reason,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint line_jobs_retry_key_key unique (retry_key),
  constraint line_jobs_work_order_customer_fk
    foreign key (work_order_id, customer_id)
    references public.work_orders (id, customer_id)
    on update cascade
    on delete restrict,
  constraint line_jobs_dedupe_key_not_blank
    check (dedupe_key is null or length(trim(dedupe_key)) > 0),
  constraint line_jobs_recipient_not_blank
    check (recipient_line_user_id is null or length(trim(recipient_line_user_id)) > 0),
  constraint line_jobs_payload_object
    check (payload is null or jsonb_typeof(payload) = 'object'),
  constraint line_jobs_attempts_valid
    check (attempts >= 0 and max_attempts > 0 and attempts <= max_attempts),
  constraint line_jobs_lock_consistent check (
    (status = 'processing' and locked_at is not null and locked_by is not null)
    or (status <> 'processing' and locked_at is null and locked_by is null)
  ),
  constraint line_jobs_skip_reason_consistent check (
    (status = 'skipped' and skip_reason is not null)
    or (status <> 'skipped' and skip_reason is null)
  ),
  constraint line_jobs_success_consistent check (
    status <> 'succeeded'
    or (
      sent_at is not null
      and recipient_line_user_id is not null
      and payload is not null
      and retry_key is not null
    )
  )
);

create unique index line_bind_tokens_one_pending_per_customer_idx
  on public.line_bind_tokens (customer_id)
  where used_at is null and revoked_at is null;

create index line_bind_tokens_customer_created_at_idx
  on public.line_bind_tokens (customer_id, created_at desc);

create index line_bind_tokens_work_order_created_at_idx
  on public.line_bind_tokens (work_order_id, created_at desc);

create unique index line_jobs_dedupe_key_idx
  on public.line_jobs (dedupe_key)
  where dedupe_key is not null;

create index line_jobs_pending_claim_idx
  on public.line_jobs (available_at, created_at)
  where status = 'pending';

create index line_jobs_processing_reclaim_idx
  on public.line_jobs (locked_at)
  where status = 'processing';

create index line_jobs_customer_created_at_idx
  on public.line_jobs (customer_id, created_at desc);

create index line_jobs_work_order_created_at_idx
  on public.line_jobs (work_order_id, created_at desc)
  where work_order_id is not null;

create trigger set_customer_line_accounts_updated_at
before update on public.customer_line_accounts
for each row execute function public.set_updated_at();

create trigger set_line_bind_tokens_updated_at
before update on public.line_bind_tokens
for each row execute function public.set_updated_at();

create trigger set_line_jobs_updated_at
before update on public.line_jobs
for each row execute function public.set_updated_at();

alter table public.customer_line_accounts enable row level security;
alter table public.line_bind_tokens enable row level security;
alter table public.line_jobs enable row level security;

create policy "Admins can manage customer LINE accounts"
on public.customer_line_accounts
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

create policy "Admins can manage LINE bind tokens"
on public.line_bind_tokens
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

create policy "Admins can manage LINE jobs"
on public.line_jobs
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

revoke all on table public.customer_line_accounts from anon;
revoke all on table public.line_bind_tokens from anon;
revoke all on table public.line_jobs from anon;

grant select, insert, update, delete on table public.customer_line_accounts to authenticated;
grant select, insert, update, delete on table public.line_bind_tokens to authenticated;
grant select, insert, update, delete on table public.line_jobs to authenticated;

grant select, insert, update, delete on table public.customer_line_accounts to service_role;
grant select, insert, update, delete on table public.line_bind_tokens to service_role;
grant select, insert, update, delete on table public.line_jobs to service_role;
