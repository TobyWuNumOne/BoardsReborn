-- confirm_public_line_binding locks the target customer row with FOR UPDATE.
-- Postgres requires UPDATE privilege for that row lock even when no customer
-- columns are modified.
grant update on table public.customers to service_role;
