do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('accounts','assets','categories','goals','imports','investments','liabilities','transactions','wealth_snapshots')
      and 'public' = any(roles)
  loop
    execute format('alter policy %I on %I.%I to authenticated', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;
