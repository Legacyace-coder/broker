create or replace function public.admin_set_user_balance(
  p_user_id uuid,
  p_target_balance numeric,
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
  balance_delta numeric;
begin
  if p_target_balance is null or p_target_balance < 0 or p_target_balance > 999999999999.99999999 then
    raise exception 'Balance must be between zero and the supported maximum';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 3 or length(p_reason) > 500 then
    raise exception 'A reason of 3 to 500 characters is required';
  end if;
  if not exists (
    select 1 from public.profiles
    where id=p_admin_id and role='admin'
  ) then
    raise exception 'Administrator access required';
  end if;
  if not exists (select 1 from public.profiles where id=p_user_id) then
    raise exception 'User not found';
  end if;

  select * into wallet_row
  from public.wallets
  where user_id=p_user_id and asset='USDT'
  for update;
  if not found then
    raise exception 'USDT wallet not found';
  end if;

  previous_balance := wallet_row.balance;
  balance_delta := p_target_balance - previous_balance;

  update public.wallets
  set balance=p_target_balance, updated_at=now()
  where user_id=p_user_id and asset='USDT';

  if balance_delta <> 0 then
    insert into public.transactions(user_id,kind,amount,asset,status,reference)
    values(
      p_user_id,
      'adjustment',
      abs(balance_delta),
      'USDT',
      'completed',
      format('Admin balance set; delta=%s; reason=%s', balance_delta, btrim(p_reason))
    );
  end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(
    p_admin_id,
    'user_balance_set',
    'wallet',
    p_user_id::text,
    jsonb_build_object(
      'asset','USDT',
      'previous_balance',previous_balance,
      'new_balance',p_target_balance,
      'delta',balance_delta,
      'reason',btrim(p_reason)
    )
  );

  return jsonb_build_object(
    'user_id',p_user_id,
    'asset','USDT',
    'previous_balance',previous_balance,
    'balance',p_target_balance,
    'delta',balance_delta
  );
end;
$$;

revoke all on function public.admin_set_user_balance(uuid,numeric,uuid,text) from public, anon, authenticated;
grant execute on function public.admin_set_user_balance(uuid,numeric,uuid,text) to service_role;
