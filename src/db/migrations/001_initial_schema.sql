-- BorjaAI V.1.2 - PostgreSQL schema for Supabase
-- Run this script in the Supabase SQL editor for the project.

create extension if not exists "pgcrypto";

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  name text not null,
  type text not null check (type in ('checking', 'savings', 'cash', 'broker', 'bank', 'other')),
  currency text not null default 'EUR',
  initial_balance numeric not null default 0,
  current_balance numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, legacy_id)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense', 'investment', 'transfer')),
  parent_id uuid references public.categories(id) on delete set null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, name, type)
);

create table if not exists public.imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  source_type text not null check (source_type in ('csv', 'pdf', 'xlsx', 'image', 'manual', 'migration')),
  file_name text not null,
  status text not null check (status in ('uploaded', 'parsed', 'reviewed', 'confirmed', 'cancelled')),
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, legacy_id)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  legacy_import_id text,
  account_legacy_id text,
  destination_account_legacy_id text,
  type text not null check (type in ('income', 'expense', 'investment', 'investment_buy', 'investment_sell', 'transfer', 'dividend', 'fee')),
  date date not null,
  description text not null,
  merchant text,
  amount numeric not null,
  category_name text,
  subcategory text,
  source text not null default 'manual',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, legacy_id)
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  type text not null check (type in ('cash', 'investment', 'crypto', 'metal', 'real_estate', 'vehicle', 'other')),
  name text not null,
  ticker text,
  current_value numeric not null default 0,
  cost_basis numeric not null default 0,
  currency text not null default 'EUR',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, legacy_id)
);

create table if not exists public.liabilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  type text not null check (type in ('loan', 'credit_card', 'mortgage', 'other')),
  name text not null,
  outstanding_balance numeric not null default 0,
  interest_rate numeric,
  monthly_payment numeric,
  currency text not null default 'EUR',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, legacy_id)
);

create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  ticker text,
  name text not null,
  type text not null,
  quantity numeric,
  buy_price numeric,
  current_price numeric,
  current_value numeric not null default 0,
  cost_basis numeric not null default 0,
  currency text not null default 'EUR',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, legacy_id)
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  name text not null,
  target_amount numeric not null default 0,
  current_amount numeric not null default 0,
  target_date date,
  priority text not null default 'Media',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, legacy_id)
);

create table if not exists public.wealth_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  snapshot_date date not null,
  assets_total numeric not null default 0,
  liabilities_total numeric not null default 0,
  net_worth numeric not null default 0,
  liquid_total numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, legacy_id)
);

alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.assets enable row level security;
alter table public.liabilities enable row level security;
alter table public.investments enable row level security;
alter table public.goals enable row level security;
alter table public.imports enable row level security;
alter table public.wealth_snapshots enable row level security;

create policy "accounts owner read" on public.accounts for select using (auth.uid() = user_id);
create policy "accounts owner insert" on public.accounts for insert with check (auth.uid() = user_id);
create policy "accounts owner update" on public.accounts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "accounts owner delete" on public.accounts for delete using (auth.uid() = user_id);

create policy "categories owner read" on public.categories for select using (auth.uid() = user_id or user_id is null);
create policy "categories owner insert" on public.categories for insert with check (auth.uid() = user_id);
create policy "categories owner update" on public.categories for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "categories owner delete" on public.categories for delete using (auth.uid() = user_id);

create policy "transactions owner read" on public.transactions for select using (auth.uid() = user_id);
create policy "transactions owner insert" on public.transactions for insert with check (auth.uid() = user_id);
create policy "transactions owner update" on public.transactions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transactions owner delete" on public.transactions for delete using (auth.uid() = user_id);

create policy "assets owner read" on public.assets for select using (auth.uid() = user_id);
create policy "assets owner insert" on public.assets for insert with check (auth.uid() = user_id);
create policy "assets owner update" on public.assets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "assets owner delete" on public.assets for delete using (auth.uid() = user_id);

create policy "liabilities owner read" on public.liabilities for select using (auth.uid() = user_id);
create policy "liabilities owner insert" on public.liabilities for insert with check (auth.uid() = user_id);
create policy "liabilities owner update" on public.liabilities for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "liabilities owner delete" on public.liabilities for delete using (auth.uid() = user_id);

create policy "investments owner read" on public.investments for select using (auth.uid() = user_id);
create policy "investments owner insert" on public.investments for insert with check (auth.uid() = user_id);
create policy "investments owner update" on public.investments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "investments owner delete" on public.investments for delete using (auth.uid() = user_id);

create policy "goals owner read" on public.goals for select using (auth.uid() = user_id);
create policy "goals owner insert" on public.goals for insert with check (auth.uid() = user_id);
create policy "goals owner update" on public.goals for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "goals owner delete" on public.goals for delete using (auth.uid() = user_id);

create policy "imports owner read" on public.imports for select using (auth.uid() = user_id);
create policy "imports owner insert" on public.imports for insert with check (auth.uid() = user_id);
create policy "imports owner update" on public.imports for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "imports owner delete" on public.imports for delete using (auth.uid() = user_id);

create policy "wealth snapshots owner read" on public.wealth_snapshots for select using (auth.uid() = user_id);
create policy "wealth snapshots owner insert" on public.wealth_snapshots for insert with check (auth.uid() = user_id);
create policy "wealth snapshots owner update" on public.wealth_snapshots for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "wealth snapshots owner delete" on public.wealth_snapshots for delete using (auth.uid() = user_id);
