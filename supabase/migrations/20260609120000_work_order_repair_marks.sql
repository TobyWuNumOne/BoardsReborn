create type public.repair_count_source as enum ('auto', 'manual');
create type public.repair_mark_board_side as enum ('front', 'back');

alter table public.work_orders
add column repair_count smallint,
add column repair_count_source public.repair_count_source not null default 'auto',
add constraint work_orders_repair_count_positive check (
  repair_count is null or repair_count >= 1
);

create table public.work_order_repair_marks (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  template_key varchar(80) not null,
  board_side public.repair_mark_board_side not null,
  x_ratio numeric(6, 5) not null,
  y_ratio numeric(6, 5) not null,
  width_ratio numeric(6, 5) not null,
  height_ratio numeric(6, 5) not null,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_order_repair_marks_template_key_length check (
    char_length(template_key) between 3 and 80
  ),
  constraint work_order_repair_marks_x_ratio_range check (
    x_ratio >= 0 and x_ratio <= 1
  ),
  constraint work_order_repair_marks_y_ratio_range check (
    y_ratio >= 0 and y_ratio <= 1
  ),
  constraint work_order_repair_marks_width_ratio_range check (
    width_ratio > 0 and width_ratio <= 1
  ),
  constraint work_order_repair_marks_height_ratio_range check (
    height_ratio > 0 and height_ratio <= 1
  ),
  constraint work_order_repair_marks_sort_order_positive check (sort_order >= 0)
);

create index work_order_repair_marks_work_order_id_sort_order_idx
on public.work_order_repair_marks(work_order_id, sort_order asc);

alter table public.work_order_repair_marks enable row level security;

create policy "Authenticated users can manage work order repair marks"
on public.work_order_repair_marks
for all
to authenticated
using (true)
with check (true);

grant select, insert, update, delete on table public.work_order_repair_marks to authenticated;
grant select on table public.work_order_repair_marks to service_role;
