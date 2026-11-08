alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references public.profiles(id) on delete set null;

update public.profiles
set referral_code = 'NS' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
where referral_code is null;

alter table public.profiles
  alter column referral_code set default 'NS' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  alter column referral_code set not null;

create unique index if not exists profiles_referral_code_uidx
  on public.profiles(referral_code);

create index if not exists profiles_referred_by_idx
  on public.profiles(referred_by);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  referrer_id uuid;
begin
  select p.id
  into referrer_id
  from public.profiles p
  where p.referral_code = pg_catalog.upper(pg_catalog.btrim(new.raw_user_meta_data->>'referral_code'))
    and p.id <> new.id
  limit 1;

  insert into public.profiles(id, email, full_name, referred_by)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    referrer_id
  )
  on conflict (id) do nothing;

  insert into public.wallets(user_id, balance, asset)
  values (new.id, 0, 'USDT')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;
