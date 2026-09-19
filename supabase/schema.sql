-- Schema Supabase para o Simulador de Apostas.
-- Execute no SQL Editor do Supabase. Os valores representam dinheiro ficticio.

create extension if not exists pgcrypto;

do $$ begin
  create type public.bet_status as enum ('PENDING', 'WON', 'LOST', 'CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.transaction_type as enum ('INITIAL_BALANCE', 'BET', 'PAYOUT', 'RESET');
exception when duplicate_object then null; end $$;

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  initial_balance numeric(12,2) not null default 1000.00 check (initial_balance >= 0),
  current_balance numeric(12,2) not null default 1000.00 check (current_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fixtures (
  id bigint primary key,
  league_name text not null,
  country text not null,
  kickoff_at timestamptz not null,
  status text not null,
  home_team text not null,
  away_team text not null,
  home_score integer,
  away_score integer,
  source text not null default 'api',
  last_updated_at timestamptz not null default now()
);

create table if not exists public.odds (
  id uuid primary key default gen_random_uuid(),
  fixture_id bigint not null references public.fixtures(id) on delete cascade,
  market text not null check (market in ('home', 'draw', 'away')),
  odd numeric(10,3) not null check (odd > 0),
  captured_at timestamptz not null default now()
);

create table if not exists public.bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stake numeric(12,2) not null check (stake > 0),
  total_odd numeric(12,3) not null check (total_odd > 0),
  potential_return numeric(12,2) not null check (potential_return >= 0),
  realized_return numeric(12,2) not null default 0 check (realized_return >= 0),
  status public.bet_status not null default 'PENDING',
  placed_at timestamptz not null default now(),
  settled_at timestamptz
);

create table if not exists public.bet_selections (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references public.bets(id) on delete cascade,
  fixture_id bigint not null references public.fixtures(id),
  market text not null check (market in ('home', 'draw', 'away')),
  odd numeric(10,3) not null check (odd > 0),
  result text check (result in ('PENDING', 'WON', 'LOST')),
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.transaction_type not null,
  amount numeric(12,2) not null,
  description text not null,
  bet_id uuid references public.bets(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists bets_user_id_placed_at_idx on public.bets(user_id, placed_at desc);
create index if not exists bet_selections_bet_id_idx on public.bet_selections(bet_id);
create index if not exists transactions_user_id_created_at_idx on public.transactions(user_id, created_at desc);
create unique index if not exists odds_fixture_market_captured_idx on public.odds(fixture_id, market, captured_at);

alter table public.user_settings enable row level security;
alter table public.bets enable row level security;
alter table public.bet_selections enable row level security;
alter table public.transactions enable row level security;
alter table public.fixtures enable row level security;
alter table public.odds enable row level security;

drop policy if exists "Users read own settings" on public.user_settings;
create policy "Users read own settings" on public.user_settings for select using (auth.uid() = user_id);
drop policy if exists "Users update own settings" on public.user_settings;
create policy "Users update own settings" on public.user_settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own bets" on public.bets;
create policy "Users manage own bets" on public.bets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage own selections" on public.bet_selections;
create policy "Users manage own selections" on public.bet_selections for all using (exists (select 1 from public.bets where bets.id = bet_selections.bet_id and bets.user_id = auth.uid())) with check (exists (select 1 from public.bets where bets.id = bet_selections.bet_id and bets.user_id = auth.uid()));
drop policy if exists "Users manage own transactions" on public.transactions;
create policy "Users manage own transactions" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Anyone reads fixtures" on public.fixtures for select using (true);
create policy "Anyone reads odds" on public.odds for select using (true);

create or replace function public.create_simulation_wallet()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.transactions (user_id, type, amount, description)
    values (new.id, 'INITIAL_BALANCE', 1000.00, 'Saldo inicial ficticio')
    on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_simulation_wallet on auth.users;
create trigger on_auth_user_created_simulation_wallet
after insert on auth.users for each row execute procedure public.create_simulation_wallet();

-- Importante: apostas e saldo devem ser gravados pelo backend ou por uma RPC transacional.
-- Nunca coloque SPORTS_API_KEY no Supabase client ou no React.
