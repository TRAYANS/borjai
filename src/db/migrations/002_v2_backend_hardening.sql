-- BorjaAI V2.0 - backend hardening
-- Safe to run after 001_initial_schema.sql.

create index if not exists accounts_user_id_idx on public.accounts(user_id);
create index if not exists accounts_user_legacy_idx on public.accounts(user_id, legacy_id);
create index if not exists transactions_user_date_idx on public.transactions(user_id, date desc);
create index if not exists transactions_user_type_idx on public.transactions(user_id, type);
create index if not exists transactions_user_legacy_idx on public.transactions(user_id, legacy_id);
create index if not exists imports_user_status_idx on public.imports(user_id, status);
create index if not exists assets_user_type_idx on public.assets(user_id, type);
create index if not exists liabilities_user_type_idx on public.liabilities(user_id, type);
create index if not exists investments_user_ticker_idx on public.investments(user_id, ticker);
create index if not exists goals_user_status_idx on public.goals(user_id, status);
create index if not exists wealth_snapshots_user_date_idx on public.wealth_snapshots(user_id, snapshot_date desc);

alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.assets enable row level security;
alter table public.liabilities enable row level security;
alter table public.investments enable row level security;
alter table public.goals enable row level security;
alter table public.imports enable row level security;
alter table public.wealth_snapshots enable row level security;

-- The API can operate in two modes:
-- 1. RLS user mode: uses a Supabase user token and these policies.
-- 2. Single-owner server mode: Vercel uses SUPABASE_SERVICE_ROLE_KEY + BORJAI_OWNER_ID.
--    The service role bypasses RLS server-side, but the key never goes to the browser.
