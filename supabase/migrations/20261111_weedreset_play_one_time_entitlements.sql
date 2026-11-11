-- Execute after reviewing the full deployment plan; no production migration is
-- applied automatically by a GitHub commit.
-- Trust boundary: only the server service_role can create entitlements.
begin;

create table if not exists public.weedreset_play_purchases (
  token_hash text primary key check (length(token_hash) = 64),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null check (product_id = 'weedreset_full_access'),
  order_id text,
  status text not null default 'active' check (status in ('active', 'revoked')),
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists weedreset_play_purchases_user_idx
  on public.weedreset_play_purchases(user_id);
alter table public.weedreset_play_purchases enable row level security;
revoke all on public.weedreset_play_purchases from public, anon, authenticated;
grant select, insert, update, delete on public.weedreset_play_purchases to service_role;

create table if not exists public.weedreset_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  source text not null check (source in ('google_play', 'manual')),
  legacy_paid_before boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.weedreset_entitlements enable row level security;
revoke all on public.weedreset_entitlements from public, anon, authenticated;
grant select on public.weedreset_entitlements to authenticated;
grant all on public.weedreset_entitlements to service_role;
drop policy if exists weedreset_entitlements_owner_read on public.weedreset_entitlements;
create policy weedreset_entitlements_owner_read
  on public.weedreset_entitlements for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.weedreset_record_google_play_purchase(
  p_user_id uuid, p_token_hash text, p_product_id text, p_order_id text
) returns void language plpgsql security invoker
set search_path = ''
as $$
declare v_premium_before boolean;
begin
  if p_product_id <> 'weedreset_full_access' or length(p_token_hash) <> 64 then
    raise exception 'invalid_google_play_product';
  end if;

  insert into public.weedreset_play_purchases(token_hash,user_id,product_id,order_id,status)
  values(p_token_hash,p_user_id,p_product_id,p_order_id,'active')
  on conflict (token_hash) do update set
    order_id = excluded.order_id, verified_at = now()
  where public.weedreset_play_purchases.user_id = excluded.user_id
    and public.weedreset_play_purchases.product_id = excluded.product_id
    and public.weedreset_play_purchases.status = 'active';

  if not found then raise exception 'purchase_belongs_to_another_account'; end if;

  select coalesce(is_premium,false) into v_premium_before
  from public.profiles where id = p_user_id;

  insert into public.weedreset_entitlements(user_id, source, legacy_paid_before)
  values(p_user_id,'google_play',coalesce(v_premium_before,false))
  on conflict (user_id) do update set
    updated_at = now();
  -- Preserve legacy clients and pre-existing premium features.
  update public.profiles set is_premium = true where id = p_user_id;
end
$$;
revoke all on function public.weedreset_record_google_play_purchase(uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function public.weedreset_record_google_play_purchase(uuid,text,text,text)
  to service_role;

-- To be called only after an independently authenticated and verified refund,
-- e.g. from a validated Play RTDN handler or secured admin reconciliation.
create or replace function public.weedreset_revoke_google_play_purchase(
  p_token_hash text
) returns void language plpgsql security invoker
set search_path = ''
as $$
declare v_user uuid; v_legacy boolean;
begin
  update public.weedreset_play_purchases set status='revoked',verified_at=now()
  where token_hash=p_token_hash returning user_id into v_user;
  if v_user is null then return; end if;
  if exists (select 1 from public.weedreset_play_purchases
    where user_id=v_user and status='active') then return; end if;
  select legacy_paid_before into v_legacy from public.weedreset_entitlements
  where user_id=v_user and source='google_play';
  if found then
    delete from public.weedreset_entitlements where user_id=v_user and source='google_play';
    update public.profiles set is_premium=coalesce(v_legacy,false) where id=v_user;
  end if;
end
$$;
revoke all on function public.weedreset_revoke_google_play_purchase(text)
  from public, anon, authenticated;
grant execute on function public.weedreset_revoke_google_play_purchase(text) to service_role;

commit;
