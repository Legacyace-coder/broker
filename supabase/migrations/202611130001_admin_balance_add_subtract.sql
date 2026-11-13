create or replace function public.admin_adjust_user_balance(
  p_user_id uuid,
  p_amount numeric,
  p_operation text,
  p_admin_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  wallet_row public.wallets%rowtype;
  previous_balance numeric;
  new_balance numeric;
  balance_delta numeric;
  audit_action text;
begin
  if p_amount is null
     or p_amount <= 0
     or p_amount > 999999999999.99999999 then
    raise exception 'Adjustment amount must be greater than zero and within the supported maximum';
  end if;

  if p_operation not in ('add', 'subtract') then
    raise exception 'Operation must be add or subtract';
  end if;

  if p_reason is null
     or length(btrim(p_reason)) < 3
     or length(p_reason) > 500 then
    raise exception 'A reason of 3 to 500 characters is required';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_admin_id
      and role = 'admin'
  ) then
    raise exception 'Administrator access required';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_user_id
  ) then
    raise exception 'User not found';
  end if;

  select *
  into wallet_row
  from public.wallets
  where user_id = p_user_id
    and asset = 'USDT'
  for update;

  if not found then
    raise exception 'USDT wallet not found';
  end if;

  previous_balance := wallet_row.balance;

  if p_operation = 'add' then
    new_balance := previous_balance + p_amount;
    audit_action := 'user_balance_added';
  else
    if previous_balance < p_amount then
      raise exception 'Insufficient balance for this subtraction';
    end if;

    new_balance := previous_balance - p_amount;
    audit_action := 'user_balance_subtracted';
  end if;

  if new_balance > 999999999999.99999999 then
    raise exception 'Resulting balance exceeds the supported maximum';
  end if;

  balance_delta := new_balance - previous_balance;

  update public.wallets
  set balance = new_balance,
      updated_at = now()
  where user_id = p_user_id
    and asset = 'USDT';

  insert into public.transactions(
    user_id,
    kind,
    amount,
    asset,
    status,
    reference
  )
  values (
    p_user_id,
    'adjustment',
    p_amount,
    'USDT',
    'completed',
    format(
      'Admin %s; reason=%s',
      p_operation,
      btrim(p_reason)
    )
  );

  insert into public.audit_logs(
    actor_id,
    action,
    entity_type,
    entity_id,
    details
  )
  values (
    p_admin_id,
    audit_action,
    'wallet',
    p_user_id::text,
    jsonb_build_object(
      'asset', 'USDT',
      'operation', p_operation,
      'amount', p_amount,
      'previous_balance', previous_balance,
      'new_balance', new_balance,
      'delta', balance_delta,
      'reason', btrim(p_reason)
    )
  );

  return jsonb_build_object(
    'user_id', p_user_id,
    'asset', 'USDT',
    'operation', p_operation,
    'amount', p_amount,
    'previous_balance', previous_balance,
    'balance', new_balance,
    'delta', balance_delta
  );
end;
$$;

revoke all on function public.admin_adjust_user_balance(uuid, numeric, text, uuid, text)
from public, anon, authenticated;

grant execute on function public.admin_adjust_user_balance(uuid, numeric, text, uuid, text)
to service_role;