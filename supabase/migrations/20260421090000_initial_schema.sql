set check_function_bodies = off;

create schema if not exists extensions;

create extension if not exists pgcrypto with schema extensions;

create type public.board_type as enum (
  'SURFBOARD',
  'SUP',
  'SNOWBOARD'
);

create type public.work_order_status as enum (
  'RECEIVED',
  'DRYING',
  'REPAIRING',
  'READY_FOR_PICKUP',
  'DELIVERED',
  'CANCELLED'
);

create type public.photo_type as enum (
  'INTAKE',
  'IN_PROGRESS',
  'SPECIAL_CONDITION',
  'COMPLETION'
);

create type public.photo_visibility as enum (
  'INTERNAL',
  'PUBLIC'
);

create type public.quote_item_type as enum (
  'INITIAL',
  'ADDITIONAL',
  'ADJUSTMENT'
);

create type public.print_job_status as enum (
  'QUEUED',
  'PROCESSING',
  'SENT_TO_PRINTER',
  'PRINTER_READY_AFTER_SEND',
  'FAILED_TRANSPORT',
  'FAILED_PRINTER_STATUS',
  'UNKNOWN',
  'REPRINT_REQUESTED'
);

create type public.label_language as enum (
  'TSPL',
  'ZPL',
  'EPL',
  'DPL'
);

create table public.admin_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name varchar(80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default extensions.gen_random_uuid(),
  name varchar(80) not null,
  phone varchar(32) not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_name_not_blank check (length(trim(name)) > 0),
  constraint customers_phone_not_blank check (length(trim(phone)) > 0)
);

create table public.work_orders (
  id uuid primary key default extensions.gen_random_uuid(),
  paper_order_no varchar(50) not null,
  customer_id uuid not null references public.customers (id) on delete restrict,
  board_type public.board_type not null,
  board_brand varchar(80),
  board_model varchar(80),
  board_size_label varchar(40),
  board_color varchar(40),
  board_serial_label varchar(80),
  intake_date date not null,
  damage_description text,
  estimated_completion_date date,
  current_status public.work_order_status not null default 'RECEIVED',
  payment_received boolean not null default false,
  payment_received_at timestamptz,
  customer_confirmed_at timestamptz,
  ready_for_pickup_at timestamptz,
  notified_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  pickup_note text,
  storage_fee_warning_after_days smallint not null default 14,
  public_note text,
  internal_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_orders_paper_order_no_key unique (paper_order_no),
  constraint work_orders_id_paper_order_no_key unique (id, paper_order_no),
  constraint work_orders_paper_order_no_length check (length(trim(paper_order_no)) between 3 and 50),
  constraint work_orders_payment_received_at_consistent check (payment_received or payment_received_at is null),
  constraint work_orders_storage_fee_warning_positive check (storage_fee_warning_after_days > 0),
  constraint work_orders_snowboard_no_drying check (
    not (
      board_type = 'SNOWBOARD'::public.board_type
      and current_status = 'DRYING'::public.work_order_status
    )
  )
);

create table public.status_history (
  id uuid primary key default extensions.gen_random_uuid(),
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  status public.work_order_status not null,
  changed_at timestamptz not null default now(),
  changed_by_user_id uuid references auth.users (id) on delete set null,
  note text
);

create table public.photos (
  id uuid primary key default extensions.gen_random_uuid(),
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  photo_type public.photo_type not null,
  visibility public.photo_visibility not null default 'INTERNAL',
  bucket varchar(64) not null default 'repair-photos',
  path text not null,
  content_type varchar(120),
  size_bytes bigint,
  metadata jsonb,
  taken_at timestamptz,
  uploaded_by_user_id uuid references auth.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  constraint photos_bucket_not_blank check (length(trim(bucket)) > 0),
  constraint photos_path_not_blank check (length(trim(path)) > 0),
  constraint photos_size_bytes_nonnegative check (size_bytes is null or size_bytes >= 0),
  constraint photos_bucket_path_key unique (bucket, path)
);

create table public.quote_items (
  id uuid primary key default extensions.gen_random_uuid(),
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  item_type public.quote_item_type not null,
  description varchar(160) not null,
  amount integer not null,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint quote_items_description_not_blank check (length(trim(description)) > 0)
);

create table public.print_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  work_order_id uuid not null,
  paper_order_no varchar(50) not null,
  status public.print_job_status not null default 'QUEUED',
  label_language public.label_language not null default 'TSPL',
  label_payload jsonb not null,
  attempt_count smallint not null default 0,
  last_error text,
  claimed_by varchar(80),
  claimed_at timestamptz,
  printed_at timestamptz,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint print_jobs_work_order_paper_order_fk foreign key (work_order_id, paper_order_no)
    references public.work_orders (id, paper_order_no)
    on update cascade
    on delete cascade,
  constraint print_jobs_paper_order_no_length check (length(trim(paper_order_no)) between 3 and 50),
  constraint print_jobs_attempt_count_nonnegative check (attempt_count >= 0),
  constraint print_jobs_label_payload_object check (jsonb_typeof(label_payload) = 'object')
);

create index customers_phone_idx on public.customers (phone);

create index work_orders_customer_id_idx on public.work_orders (customer_id);
create index work_orders_board_type_idx on public.work_orders (board_type);
create index work_orders_current_status_idx on public.work_orders (current_status);
create index work_orders_estimated_completion_date_idx on public.work_orders (estimated_completion_date);
create index work_orders_intake_date_idx on public.work_orders (intake_date);
create index work_orders_notified_open_pickup_idx on public.work_orders (notified_at)
  where notified_at is not null and picked_up_at is null;

create index status_history_work_order_changed_at_idx on public.status_history (work_order_id, changed_at desc);
create index status_history_status_changed_at_idx on public.status_history (status, changed_at desc);

create index photos_work_order_created_at_idx on public.photos (work_order_id, created_at desc);
create index photos_photo_type_idx on public.photos (photo_type);

create index quote_items_work_order_created_at_idx on public.quote_items (work_order_id, created_at asc);
create unique index quote_items_one_initial_per_work_order_idx
  on public.quote_items (work_order_id)
  where item_type = 'INITIAL';

create index print_jobs_status_created_at_idx on public.print_jobs (status, created_at asc);
create index print_jobs_work_order_created_at_idx on public.print_jobs (work_order_id, created_at desc);
create index print_jobs_paper_order_no_idx on public.print_jobs (paper_order_no);
create index print_jobs_claimed_by_claimed_at_idx on public.print_jobs (claimed_by, claimed_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_admin_profiles_updated_at
before update on public.admin_profiles
for each row execute function public.set_updated_at();

create trigger set_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create trigger set_work_orders_updated_at
before update on public.work_orders
for each row execute function public.set_updated_at();

create trigger set_print_jobs_updated_at
before update on public.print_jobs
for each row execute function public.set_updated_at();

create or replace function public.prevent_snowboard_drying_status_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'DRYING'::public.work_order_status
    and exists (
      select 1
      from public.work_orders
      where id = new.work_order_id
        and board_type = 'SNOWBOARD'::public.board_type
    )
  then
    raise exception 'SNOWBOARD work orders cannot enter DRYING'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger prevent_snowboard_drying_status_history
before insert or update on public.status_history
for each row execute function public.prevent_snowboard_drying_status_history();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'repair-photos',
  'repair-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.admin_profiles enable row level security;
alter table public.customers enable row level security;
alter table public.work_orders enable row level security;
alter table public.status_history enable row level security;
alter table public.photos enable row level security;
alter table public.quote_items enable row level security;
alter table public.print_jobs enable row level security;

create policy "Authenticated users can manage admin profiles"
on public.admin_profiles
for all
to authenticated
using (true)
with check (true);

create policy "Authenticated users can manage customers"
on public.customers
for all
to authenticated
using (true)
with check (true);

create policy "Authenticated users can manage work orders"
on public.work_orders
for all
to authenticated
using (true)
with check (true);

create policy "Authenticated users can manage status history"
on public.status_history
for all
to authenticated
using (true)
with check (true);

create policy "Authenticated users can manage photos"
on public.photos
for all
to authenticated
using (true)
with check (true);

create policy "Authenticated users can manage quote items"
on public.quote_items
for all
to authenticated
using (true)
with check (true);

create policy "Authenticated users can manage print jobs"
on public.print_jobs
for all
to authenticated
using (true)
with check (true);

create policy "Authenticated users can read repair photo bucket"
on storage.buckets
for select
to authenticated
using (id = 'repair-photos');

create policy "Authenticated users can manage repair photos"
on storage.objects
for all
to authenticated
using (bucket_id = 'repair-photos')
with check (bucket_id = 'repair-photos');
