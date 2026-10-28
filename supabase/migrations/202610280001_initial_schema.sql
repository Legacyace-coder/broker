-- Northstar Capital initial schema. Review and test in a non-production project first.
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

do $$ begin
  create type public.request_status as enum ('pending','approved','rejected','completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.transaction_kind as enum ('deposit','withdrawal','adjustment');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  phone text not null default '',
  role text not null default 'member' check (role in ('member','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance numeric(20,8) not null default 0 check (balance >= 0),
  asset text not null default 'USDT',
  updated_at timestamptz not null default now()
);
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  minimum_amount numeric(20,8) not null check (minimum_amount > 0),
  maximum_amount numeric(20,8),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (maximum_amount is null or maximum_amount >= minimum_amount)
);
create table if not exists public.deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(20,8) not null check (amount > 0),
  asset text not null default 'USDT',
  network text not null default 'TRC20',
  reference text,
  status public.request_status not null default 'pending',
  review_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(20,8) not null check (amount > 0),
  asset text not null default 'USDT',
  network text not null default 'TRC20',
  wallet_address text not null,
  status public.request_status not null default 'pending',
  review_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  kind public.transaction_kind not null,
  amount numeric(20,8) not null check (amount > 0),
  asset text not null default 'USDT',
  status public.request_status not null default 'pending',
  reference text,
  created_at timestamptz not null default now()
);
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists deposits_user_created_idx on public.deposits(user_id, created_at desc);
create index if not exists withdrawals_user_created_idx on public.withdrawals(user_id, created_at desc);
create index if not exists transactions_user_created_idx on public.transactions(user_id, created_at desc);
create index if not exists audit_created_idx on public.audit_logs(created_at desc);

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,email,full_name) values (new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name','')) on conflict (id) do nothing;
  insert into public.wallets(user_id,balance,asset) values (new.id,0,'USDT') on conflict (user_id) do nothing;
  return new;
end; $$;
revoke all on function private.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

-- RPC functions are isolated in a non-exposed schema and granted only to service_role.
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
grant usage on schema private to service_role;
grant execute on function public.request_withdrawal(uuid,numeric,text,text,text) to service_role;
grant execute on function public.review_deposit(uuid,text,uuid,text) to service_role;
grant execute on function public.review_withdrawal(uuid,text,uuid,text) to service_role;

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.plans enable row level security;
alter table public.deposits enable row level security;
alter table public.withdrawals enable row level security;
alter table public.transactions enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid())=id);
create policy "profiles_update_own_nonprivileged" on public.profiles for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id and role='member');
create policy "wallets_select_own" on public.wallets for select to authenticated using ((select auth.uid())=user_id);
create policy "plans_read_active" on public.plans for select to anon, authenticated using (active=true);
create policy "deposits_select_own" on public.deposits for select to authenticated using ((select auth.uid())=user_id);
create policy "withdrawals_select_own" on public.withdrawals for select to authenticated using ((select auth.uid())=user_id);
create policy "transactions_select_own" on public.transactions for select to authenticated using ((select auth.uid())=user_id);
-- No direct client inserts/updates for financial tables; requests go through the authenticated API.
-- Admin service-role operations bypass RLS; backend must verify role before every admin endpoint.

insert into public.plans(name,description,minimum_amount,maximum_amount,active)
select 'Starter','Example plan for displaying product information. No yield or return is promised.',25,500,true
where not exists (select 1 from public.plans where name='Starter');
insert into public.plans(name,description,minimum_amount,maximum_amount,active)
select 'Growth','Example plan; suitability and risk information must be reviewed before use.',500,5000,true
where not exists (select 1 from public.plans where name='Growth');
insert into public.plans(name,description,minimum_amount,maximum_amount,active)
select 'Institutional','Example category for enquiries; not an offer or a promise of performance.',5000,null,true
where not exists (select 1 from public.plans where name='Institutional');
