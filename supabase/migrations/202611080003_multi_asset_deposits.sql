alter table public.payment_instructions
  add column if not exists asset text not null default 'USDT';

alter table public.payment_instructions
  drop constraint if exists payment_instructions_pkey;

alter table public.payment_instructions
  add constraint payment_instructions_pkey primary key (method, asset);

alter table public.payment_instructions
  drop constraint if exists payment_instructions_asset_check;

alter table public.payment_instructions
  add constraint payment_instructions_asset_check check (
    (method = 'crypto' and asset in ('USDT', 'BTC', 'ETH', 'USDC'))
    or (method = 'bank' and asset = 'USDT')
  );

alter table public.deposits
  drop constraint if exists deposits_payment_details_check;

alter table public.deposits
  add constraint deposits_payment_details_check check (
    (
      payment_method = 'crypto'
      and payment_currency = 'USDT'
      and payment_amount = amount
    )
    or (
      payment_method = 'crypto'
      and payment_currency in ('BTC', 'ETH', 'USDC')
      and payment_amount is not null
    )
    or (
      payment_method = 'bank'
      and payment_amount is not null
      and payment_currency ~ '^[A-Za-z]{3}$'
    )
  );

create or replace function public.review_deposit(
  p_deposit_id uuid,
  p_status text,
  p_admin_id uuid,
  p_note text default null,
  p_credited_amount numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  deposit_row public.deposits%rowtype;
  credit_value numeric;
begin
  if p_status not in ('approved', 'rejected') then
    raise exception 'Invalid status';
  end if;

  select * into deposit_row
  from public.deposits
  where id = p_deposit_id
  for update;

  if not found or deposit_row.status <> 'pending' then
    raise exception 'Deposit already reviewed or missing';
  end if;

  if p_status = 'approved' then
    if deposit_row.payment_method = 'bank'
       or deposit_row.payment_currency <> 'USDT' then
      if p_credited_amount is null
         or p_credited_amount <= 0
         or p_credited_amount > 1000000 then
        raise exception 'A valid reconciled USDT credit amount is required';
      end if;
      credit_value := p_credited_amount;
    else
      if p_credited_amount is not null
         and p_credited_amount <> deposit_row.amount then
        raise exception 'USDT deposits are credited at the requested amount';
      end if;
      credit_value := deposit_row.amount;
    end if;
  elsif p_credited_amount is not null then
    raise exception 'Rejected deposits cannot have a credited amount';
  end if;

  update public.deposits
  set status = p_status::public.request_status,
      review_note = p_note,
      reviewed_by = p_admin_id,
      reviewed_at = now(),
      credited_amount = credit_value
  where id = p_deposit_id
  returning * into deposit_row;

  if p_status = 'approved' then
    update public.wallets
    set balance = balance + credit_value,
        updated_at = now()
    where user_id = deposit_row.user_id
      and asset = 'USDT';

    if not found then
      raise exception 'USDT wallet not found';
    end if;

    insert into public.transactions(user_id, kind, amount, asset, status, reference)
    values (
      deposit_row.user_id,
      'deposit',
      credit_value,
      'USDT',
      'completed',
      deposit_row.id::text
    );
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (
    p_admin_id,
    'deposit_' || p_status,
    'deposit',
    deposit_row.id::text,
    jsonb_build_object(
      'user_id', deposit_row.user_id,
      'payment_method', deposit_row.payment_method,
      'payment_currency', deposit_row.payment_currency,
      'payment_amount', deposit_row.payment_amount,
      'credited_amount', credit_value,
      'note', p_note
    )
  );

  return to_jsonb(deposit_row);
end;
$$;

revoke all on function public.review_deposit(uuid, text, uuid, text, numeric)
  from public, anon, authenticated;
grant execute on function public.review_deposit(uuid, text, uuid, text, numeric)
  to service_role;
