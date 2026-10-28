alter table public.deposits
  add column if not exists payment_method text not null default 'crypto'
    check (payment_method in ('crypto', 'bank')),
  add column if not exists payment_amount numeric(20,8)
    check (payment_amount is null or payment_amount > 0),
  add column if not exists payment_currency text,
  add column if not exists credited_amount numeric(20,8)
    check (credited_amount is null or credited_amount > 0);

update public.deposits
set payment_amount=amount, payment_currency='USDT'
where payment_method='crypto' and payment_amount is null;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.deposits'::regclass
      and conname='deposits_payment_details_check'
  ) then
    alter table public.deposits add constraint deposits_payment_details_check check (
      (payment_method='crypto' and payment_currency='USDT' and payment_amount=amount)
      or
      (payment_method='bank' and payment_amount is not null and payment_currency ~ '^[A-Za-z]{3}$')
    );
  end if;
end $$;

create table if not exists public.payment_instructions (
  method text primary key check (method in ('crypto', 'bank')),
  enabled boolean not null default false,
  network text not null default '',
  wallet_address text not null default '',
  bank_name text not null default '',
  account_name text not null default '',
  account_number text not null default '',
  iban text not null default '',
  swift_bic text not null default '',
  currency text not null default '',
  instructions text not null default '',
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  check (
    not enabled
    or (
      method='crypto'
      and length(btrim(network)) >= 2
      and length(btrim(wallet_address)) >= 8
    )
    or (
      method='bank'
      and length(btrim(bank_name)) >= 2
      and length(btrim(account_name)) >= 2
      and length(btrim(account_number)) >= 3
      and currency ~ '^[A-Za-z]{3}$'
    )
  )
);

alter table public.payment_instructions enable row level security;
revoke all on public.payment_instructions from anon, authenticated;
grant select, insert, update on public.payment_instructions to service_role;

drop function if exists public.review_deposit(uuid,text,uuid,text);
create function public.review_deposit(
  p_deposit_id uuid,
  p_status text,
  p_admin_id uuid,
  p_note text default null,
  p_credited_amount numeric default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d public.deposits%rowtype; credit_value numeric;
begin
  if p_status not in ('approved','rejected') then raise exception 'Invalid status'; end if;
  select * into d from public.deposits where id=p_deposit_id for update;
  if not found or d.status <> 'pending' then raise exception 'Deposit already reviewed or missing'; end if;
  if p_status='approved' and upper(d.asset) <> 'USDT' then raise exception 'Only USDT deposits can be approved'; end if;

  if p_status='approved' then
    if d.payment_method='bank' then
      if p_credited_amount is null or p_credited_amount <= 0 or p_credited_amount > 1000000 then
        raise exception 'A valid reconciled USDT credit amount is required';
      end if;
      credit_value := p_credited_amount;
    else
      if p_credited_amount is not null and p_credited_amount <> d.amount then
        raise exception 'Crypto deposit credit must match the requested amount';
      end if;
      credit_value := d.amount;
    end if;
  elsif p_credited_amount is not null then
    raise exception 'Rejected deposits cannot have a credited amount';
  end if;

  update public.deposits
  set status=p_status::public.request_status,
      review_note=p_note,
      reviewed_by=p_admin_id,
      reviewed_at=now(),
      credited_amount=credit_value
  where id=p_deposit_id
  returning * into d;

  if p_status='approved' then
    update public.wallets set balance=balance+credit_value, updated_at=now()
    where user_id=d.user_id and asset='USDT';
    if not found then raise exception 'USDT wallet not found'; end if;
    insert into public.transactions(user_id,kind,amount,asset,status,reference)
    values(d.user_id,'deposit',credit_value,'USDT','completed',d.id::text);
  end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(p_admin_id,'deposit_'||p_status,'deposit',d.id::text,
    jsonb_build_object('user_id',d.user_id,'payment_method',d.payment_method,'requested_amount',d.amount,'credited_amount',credit_value,'note',p_note));
  return to_jsonb(d);
end; $$;

create or replace function public.review_withdrawal(p_withdrawal_id uuid, p_status text, p_admin_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare w public.withdrawals%rowtype;
begin
  if p_status not in ('approved','rejected','completed') then raise exception 'Invalid status'; end if;
  select * into w from public.withdrawals where id=p_withdrawal_id for update;
  if not found then raise exception 'Withdrawal not found'; end if;
  if p_status='completed' then
    if w.status <> 'approved' then raise exception 'Only approved withdrawals can be completed'; end if;
    if p_note is null or length(btrim(p_note))=0 then raise exception 'A transfer reference is required'; end if;
  elsif w.status <> 'pending' then
    raise exception 'Withdrawal already reviewed';
  end if;
  if upper(w.asset) <> 'USDT' then raise exception 'Only USDT withdrawals can be reviewed'; end if;

  update public.withdrawals
  set status=p_status::public.request_status, review_note=p_note, reviewed_by=p_admin_id, reviewed_at=now()
  where id=p_withdrawal_id returning * into w;

  if p_status='rejected' then
    update public.wallets set balance=balance+w.amount, updated_at=now()
    where user_id=w.user_id and asset='USDT';
    if not found then raise exception 'USDT wallet not found'; end if;
    update public.transactions set status='rejected'
    where user_id=w.user_id and kind='withdrawal' and reference=w.id::text and status='pending';
  elsif p_status='approved' then
    update public.transactions set status='approved'
    where user_id=w.user_id and kind='withdrawal' and reference=w.id::text and status='pending';
  else
    update public.transactions set status='completed'
    where user_id=w.user_id and kind='withdrawal' and reference=w.id::text and status='approved';
  end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(p_admin_id,'withdrawal_'||p_status,'withdrawal',w.id::text,
    jsonb_build_object('user_id',w.user_id,'amount',w.amount,'note',p_note));
  return to_jsonb(w);
end; $$;

revoke all on function public.review_deposit(uuid,text,uuid,text,numeric) from public, anon, authenticated;
revoke all on function public.review_withdrawal(uuid,text,uuid,text) from public, anon, authenticated;
grant execute on function public.review_deposit(uuid,text,uuid,text,numeric) to service_role;
grant execute on function public.review_withdrawal(uuid,text,uuid,text) to service_role;
