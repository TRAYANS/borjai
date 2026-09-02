-- BorjaAI V2.0.1 - explicit Supabase Data API grants
-- Keep table-level access explicit. RLS policies remain the row-level security boundary.
-- The browser uses the authenticated role; server-side jobs use service_role.

grant select, insert, update, delete on table
  public.accounts,
  public.categories,
  public.transactions,
  public.assets,
  public.liabilities,
  public.investments,
  public.goals,
  public.imports,
  public.wealth_snapshots
to authenticated;

grant select, insert, update, delete on table
  public.accounts,
  public.categories,
  public.transactions,
  public.assets,
  public.liabilities,
  public.investments,
  public.goals,
  public.imports,
  public.wealth_snapshots
to service_role;

-- No anonymous grant is intentionally added: BorjaAI requires Supabase Auth.
