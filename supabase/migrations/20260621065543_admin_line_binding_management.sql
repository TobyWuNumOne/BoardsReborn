create or replace function public.issue_admin_line_bind_token(
  p_token_id uuid,
  p_token_hash text,
  p_work_order_id uuid,
  p_created_by uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_expires_at timestamptz;
  v_revoked_count integer;
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid LINE bind token hash'
      using errcode = '23514';
  end if;

  select work_orders.customer_id
  into v_customer_id
  from public.work_orders
  where work_orders.id = p_work_order_id;

  if not found then
    raise exception 'Work order not found'
      using errcode = 'P0002';
  end if;

  perform 1
  from public.customers
  where customers.id = v_customer_id
  for update;

  if exists (
    select 1
    from public.customer_line_accounts
    where customer_line_accounts.customer_id = v_customer_id
  ) then
    raise exception 'Customer already has active LINE binding'
      using errcode = '23514';
  end if;

  update public.line_bind_tokens
  set revoked_at = statement_timestamp()
  where customer_id = v_customer_id
    and used_at is null
    and revoked_at is null;

  get diagnostics v_revoked_count = row_count;
  v_expires_at := statement_timestamp() + interval '30 days';

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
    v_customer_id,
    p_work_order_id,
    v_expires_at,
    p_created_by
  );

  return jsonb_build_object(
    'id', p_token_id,
    'expiresAt', v_expires_at,
    'revokedTokenCount', v_revoked_count
  );
end;
$$;

create or replace function public.unlink_admin_customer_line_binding(
  p_customer_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_unlinked_at timestamptz := statement_timestamp();
  v_deleted_count integer;
  v_revoked_count integer;
  v_skipped_count integer;
begin
  perform 1
  from public.customers
  where customers.id = p_customer_id
  for update;

  if not found then
    raise exception 'Customer not found'
      using errcode = 'P0002';
  end if;

  delete from public.customer_line_accounts
  where customer_id = p_customer_id;

  get diagnostics v_deleted_count = row_count;

  if v_deleted_count = 0 then
    raise exception 'No active LINE binding'
      using errcode = 'P0002';
  end if;

  update public.line_bind_tokens
  set revoked_at = v_unlinked_at
  where customer_id = p_customer_id
    and used_at is null
    and revoked_at is null;

  get diagnostics v_revoked_count = row_count;

  update public.line_jobs
  set
    status = 'skipped'::public.line_job_status,
    skip_reason = 'no_active_line_binding'::public.line_job_skip_reason
  where customer_id = p_customer_id
    and status = 'pending'::public.line_job_status;

  get diagnostics v_skipped_count = row_count;

  return jsonb_build_object(
    'customerId', p_customer_id,
    'unlinkedAt', v_unlinked_at,
    'revokedTokenCount', v_revoked_count,
    'skippedPendingJobCount', v_skipped_count
  );
end;
$$;

revoke all on function public.issue_admin_line_bind_token(uuid, text, uuid, uuid) from public;
revoke all on function public.unlink_admin_customer_line_binding(uuid) from public;

grant execute on function public.issue_admin_line_bind_token(uuid, text, uuid, uuid)
to authenticated;
grant execute on function public.unlink_admin_customer_line_binding(uuid)
to authenticated;
