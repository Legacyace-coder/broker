-- Keep existing installations aligned with the single-USDT wallet model.
create or replace function public.request_withdrawal(p_user_id uuid, p_amount numeric, p_asset text, p_network text, p_wallet_address text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare w public.wallets%rowtype; x public.withdrawals%rowtype;
begin
  if p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  if upper(p_asset) <> 'USDT' then raise exception 'Only USDT withdrawals are supported'; end if;
  select * into w from public.wallets where user_id=p_user_id and asset=upper(p_asset) for update;
  if not found or w.balance < p_amount then raise exception 'Insufficient balance'; end if;
  update public.wallets set balance=balance-p_amount, updated_at=now() where user_id=p_user_id and asset=upper(p_asset);
  insert into public.withdrawals(user_id,amount,asset,network,wallet_address,status) values(p_user_id,p_amount,upper(p_asset),p_network,p_wallet_address,'pending') returning * into x;
  insert into public.transactions(user_id,kind,amount,asset,status,reference) values(p_user_id,'withdrawal',p_amount,upper(p_asset),'pending',x.id::text);
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details) values(p_user_id,'withdrawal_requested','withdrawal',x.id::text,jsonb_build_object('amount',p_amount,'asset',upper(p_asset)));
  return to_jsonb(x);
end; $$;

create or replace function public.review_deposit(p_deposit_id uuid, p_status text, p_admin_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d public.deposits%rowtype;
begin
  if p_status not in ('approved','rejected') then raise exception 'Invalid status'; end if;
  select * into d from public.deposits where id=p_deposit_id for update;
  if not found or d.status <> 'pending' then raise exception 'Deposit already reviewed or missing'; end if;
  if p_status='approved' and upper(d.asset) <> 'USDT' then raise exception 'Only USDT deposits can be approved'; end if;
  update public.deposits set status=p_status::public.request_status, review_note=p_note, reviewed_by=p_admin_id, reviewed_at=now() where id=p_deposit_id returning * into d;
  if p_status='approved' then
    update public.wallets set balance=balance+d.amount, updated_at=now() where user_id=d.user_id and asset=d.asset;
    if not found then raise exception 'Matching wallet not found'; end if;
    insert into public.transactions(user_id,kind,amount,asset,status,reference) values(d.user_id,'deposit',d.amount,d.asset,'completed',d.id::text);
  end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details) values(p_admin_id,'deposit_'||p_status,'deposit',d.id::text,jsonb_build_object('user_id',d.user_id,'amount',d.amount,'note',p_note));
  return to_jsonb(d);
end; $$;

create or replace function public.review_withdrawal(p_withdrawal_id uuid, p_status text, p_admin_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare w public.withdrawals%rowtype;
begin
  if p_status not in ('approved','rejected') then raise exception 'Invalid status'; end if;
  select * into w from public.withdrawals where id=p_withdrawal_id for update;
  if not found or w.status <> 'pending' then raise exception 'Withdrawal already reviewed or missing'; end if;
  if upper(w.asset) <> 'USDT' then raise exception 'Only USDT withdrawals can be reviewed'; end if;
  update public.withdrawals set status=p_status::public.request_status, review_note=p_note, reviewed_by=p_admin_id, reviewed_at=now() where id=p_withdrawal_id returning * into w;
  if p_status='rejected' then
    update public.wallets set balance=balance+w.amount, updated_at=now() where user_id=w.user_id and asset=upper(w.asset);
    if not found then raise exception 'Matching wallet not found'; end if;
    update public.transactions set status='rejected' where user_id=w.user_id and kind='withdrawal' and reference=w.id::text and status='pending';
  else
    -- This is an administrative review state, not a blockchain/payment-provider transfer.
    update public.transactions set status='approved' where user_id=w.user_id and kind='withdrawal' and reference=w.id::text and status='pending';
  end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details) values(p_admin_id,'withdrawal_'||p_status,'withdrawal',w.id::text,jsonb_build_object('user_id',w.user_id,'amount',w.amount,'note',p_note));
  return to_jsonb(w);
end; $$;

revoke all on function public.request_withdrawal(uuid,numeric,text,text,text) from public, anon, authenticated;
revoke all on function public.review_deposit(uuid,text,uuid,text) from public, anon, authenticated;
revoke all on function public.review_withdrawal(uuid,text,uuid,text) from public, anon, authenticated;
grant execute on function public.request_withdrawal(uuid,numeric,text,text,text) to service_role;
grant execute on function public.review_deposit(uuid,text,uuid,text) to service_role;
grant execute on function public.review_withdrawal(uuid,text,uuid,text) to service_role;
