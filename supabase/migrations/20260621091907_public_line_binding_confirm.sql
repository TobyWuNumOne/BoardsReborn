create or replace function public.confirm_public_line_binding(
  p_token_hash text,
  p_line_user_id text,
  p_display_name text default null,
  p_picture_url text default null,
  p_friendship_checked boolean default false,
  p_is_friend boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_token public.line_bind_tokens;
  v_work_order public.work_orders;
  v_line_account public.customer_line_accounts;
  v_customer_account public.customer_line_accounts;
  v_linked_at timestamptz;
  v_job_type public.line_job_type;
  v_dedupe_key text;
begin
  select * into v_token
  from public.line_bind_tokens
  where token_hash = p_token_hash
  for update;

  if not found then return jsonb_build_object('outcome', 'token_invalid'); end if;
  if v_token.revoked_at is not null then return jsonb_build_object('outcome', 'token_revoked'); end if;
  if v_token.used_at is not null then return jsonb_build_object('outcome', 'token_used'); end if;
  if v_token.expires_at <= v_now then return jsonb_build_object('outcome', 'token_expired'); end if;

  select * into v_work_order
  from public.work_orders
  where id = v_token.work_order_id;
  if not found then return jsonb_build_object('outcome', 'token_invalid'); end if;

  perform 1 from public.customers where id = v_token.customer_id for update;

  select * into v_line_account
  from public.customer_line_accounts
  where line_user_id = p_line_user_id;

  if found and v_line_account.customer_id <> v_token.customer_id then
    update public.line_bind_tokens set revoked_at = v_now where id = v_token.id;
    return jsonb_build_object('outcome', 'line_conflict');
  end if;

  select * into v_customer_account
  from public.customer_line_accounts
  where customer_id = v_token.customer_id;

  if found and v_customer_account.line_user_id <> p_line_user_id then
    update public.line_bind_tokens set revoked_at = v_now where id = v_token.id;
    return jsonb_build_object('outcome', 'customer_conflict');
  end if;

  if v_customer_account.id is not null then
    update public.customer_line_accounts
    set
      display_name = coalesce(p_display_name, display_name),
      picture_url = coalesce(p_picture_url, picture_url),
      last_seen_at = case when p_friendship_checked then v_now else last_seen_at end,
      is_friend = case when p_friendship_checked then p_is_friend else is_friend end,
      blocked_at = case when p_friendship_checked and p_is_friend then null else blocked_at end
    where id = v_customer_account.id
    returning linked_at into v_linked_at;

    update public.line_bind_tokens set used_at = v_now where id = v_token.id;
    update public.line_bind_tokens
    set revoked_at = v_now
    where customer_id = v_token.customer_id and id <> v_token.id
      and used_at is null and revoked_at is null;

    return jsonb_build_object(
      'outcome', 'already_linked',
      'paperOrderNo', v_work_order.paper_order_no,
      'linkedAt', v_linked_at,
      'usedAt', v_now,
      'notificationStatus', case
        when p_friendship_checked and p_is_friend then 'notifyable'
        when p_friendship_checked then 'not_notifyable'
        else 'unknown'
      end
    );
  end if;

  insert into public.customer_line_accounts (
    customer_id, line_user_id, display_name, picture_url,
    linked_at, last_seen_at, is_friend
  ) values (
    v_token.customer_id, p_line_user_id, p_display_name, p_picture_url,
    v_now, case when p_friendship_checked then v_now else null end,
    case when p_friendship_checked then p_is_friend else false end
  ) returning linked_at into v_linked_at;

  update public.line_bind_tokens set used_at = v_now where id = v_token.id;
  update public.line_bind_tokens
  set revoked_at = v_now
  where customer_id = v_token.customer_id and id <> v_token.id
    and used_at is null and revoked_at is null;

  if v_work_order.current_status = 'READY_FOR_PICKUP'::public.work_order_status
    and v_work_order.notified_at is null
  then
    v_job_type := 'work_order_ready_for_pickup'::public.line_job_type;
    v_dedupe_key := 'auto:ready:' || v_work_order.id::text;
  else
    v_job_type := 'line_binding_success'::public.line_job_type;
    v_dedupe_key := 'auto:binding:' || v_token.id::text;
  end if;

  insert into public.line_jobs (
    customer_id, work_order_id, job_type, dedupe_key
  ) values (
    v_token.customer_id, v_work_order.id, v_job_type, v_dedupe_key
  ) on conflict do nothing;

  return jsonb_build_object(
    'outcome', 'linked',
    'paperOrderNo', v_work_order.paper_order_no,
    'linkedAt', v_linked_at,
    'usedAt', v_now,
    'notificationStatus', case
      when p_friendship_checked and p_is_friend then 'notifyable'
      when p_friendship_checked then 'not_notifyable'
      else 'unknown'
    end,
    'jobType', v_job_type
  );
end;
$$;

revoke all on function public.confirm_public_line_binding(text, text, text, text, boolean, boolean) from public;
grant execute on function public.confirm_public_line_binding(text, text, text, text, boolean, boolean)
to service_role;
