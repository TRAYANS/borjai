create index if not exists categories_parent_id_idx on public.categories(parent_id);

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename in ('accounts','assets','categories','goals','imports','investments','liabilities','transactions','wealth_snapshots')
      and (qual like '%auth.uid()%' or with_check like '%auth.uid()%')
  loop
    if r.qual is not null and r.with_check is not null then
      execute format('alter policy %I on %I.%I using (%s) with check (%s)', r.policyname, r.schemaname, r.tablename, replace(r.qual, 'auth.uid()', '(select auth.uid())'), replace(r.with_check, 'auth.uid()', '(select auth.uid())'));
    elsif r.qual is not null then
      execute format('alter policy %I on %I.%I using (%s)', r.policyname, r.schemaname, r.tablename, replace(r.qual, 'auth.uid()', '(select auth.uid())'));
    elsif r.with_check is not null then
      execute format('alter policy %I on %I.%I with check (%s)', r.policyname, r.schemaname, r.tablename, replace(r.with_check, 'auth.uid()', '(select auth.uid())'));
    end if;
  end loop;
end $$;
