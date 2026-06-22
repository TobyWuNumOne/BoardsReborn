alter table public.customer_line_accounts
add column friendship_checked_at timestamptz;

alter table public.customer_line_accounts
add constraint customer_line_accounts_friendship_checked_at_valid
check (friendship_checked_at is null or friendship_checked_at >= created_at);
