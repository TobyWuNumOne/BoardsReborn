create or replace function public.issue_line_bind_token(
  p_token_id uuid,
  p_token_hash text,
  p_customer_id uuid,
  p_work_order_id uuid,
  p_created_by uuid default null
)
returns public.line_bind_tokens
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_token public.line_bind_tokens;
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid LINE bind token hash'
      using errcode = '23514';
  end if;

  perform 1
  from public.customers
  where customers.id = p_customer_id
  for update;

  if not found then
    raise exception 'Customer not found'
      using errcode = 'P0002';
  end if;

  update public.line_bind_tokens
  set revoked_at = statement_timestamp()
  where customer_id = p_customer_id
    and used_at is null
    and revoked_at is null;

  insert into public.line_bind_tokens (
    id,
    token_hash,
    customer_id,
    work_order_id,
    expires_at,
    created_by
  )
  values (
    p_token_id,
    p_token_hash,
    p_customer_id,
    p_work_order_id,
    statement_timestamp() + interval '30 days',
    p_created_by
  )
  returning * into v_token;

  return v_token;
end;
$$;

create or replace function public.revoke_pending_line_bind_tokens(
  p_customer_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_revoked_count integer;
begin
  perform 1
  from public.customers
  where customers.id = p_customer_id
  for update;

  if not found then
    raise exception 'Customer not found'
      using errcode = 'P0002';
  end if;

  update public.line_bind_tokens
  set revoked_at = statement_timestamp()
  where customer_id = p_customer_id
    and used_at is null
    and revoked_at is null;

  get diagnostics v_revoked_count = row_count;
  return v_revoked_count;
end;
$$;

revoke all on function public.issue_line_bind_token(uuid, text, uuid, uuid, uuid) from public;
revoke all on function public.revoke_pending_line_bind_tokens(uuid) from public;

grant execute on function public.issue_line_bind_token(uuid, text, uuid, uuid, uuid)
to authenticated, service_role;
grant execute on function public.revoke_pending_line_bind_tokens(uuid)
to authenticated, service_role;
