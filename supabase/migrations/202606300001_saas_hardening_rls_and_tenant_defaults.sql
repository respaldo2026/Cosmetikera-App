-- =====================================================
-- SaaS Hardening
-- - elimina fallback implícito al tenant principal para usuarios autenticados
-- - reaplica RLS estricta en todas las tablas public con tenant_id
-- =====================================================

create or replace function public.effective_tenant_id()
returns uuid
language sql
stable
as $$
  select coalesce(
    public.current_tenant_id(),
    (
      select tm.tenant_id
      from public.tenant_memberships tm
      where tm.user_id = auth.uid()
        and tm.is_default = true
      order by tm.created_at asc
      limit 1
    ),
    (
      select tm.tenant_id
      from public.tenant_memberships tm
      where tm.user_id = auth.uid()
      order by tm.created_at asc
      limit 1
    )
  );
$$;

do $$
declare
  v_table_name text;
  v_policy record;
  qualified_name text;
begin
  for v_table_name in
    select distinct c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'tenant_id'
      and c.table_name not in ('tenant_memberships')
    order by c.table_name
  loop
    qualified_name := format('public.%I', v_table_name);

    if to_regclass(qualified_name) is null then
      continue;
    end if;

    execute format('alter table %s enable row level security', qualified_name);

    for v_policy in
      select p.policyname
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = v_table_name
    loop
      execute format('drop policy if exists %I on %s', v_policy.policyname, qualified_name);
    end loop;

    execute format(
      'create policy %I on %s for select to authenticated using (tenant_id = public.effective_tenant_id() and public.is_tenant_member(tenant_id))',
      v_table_name || '_tenant_select',
      qualified_name
    );

    execute format(
      'create policy %I on %s for insert to authenticated with check (tenant_id = public.effective_tenant_id() and public.is_tenant_member(tenant_id))',
      v_table_name || '_tenant_insert',
      qualified_name
    );

    execute format(
      'create policy %I on %s for update to authenticated using (tenant_id = public.effective_tenant_id() and public.is_tenant_member(tenant_id)) with check (tenant_id = public.effective_tenant_id() and public.is_tenant_member(tenant_id))',
      v_table_name || '_tenant_update',
      qualified_name
    );

    execute format(
      'create policy %I on %s for delete to authenticated using (tenant_id = public.effective_tenant_id() and public.is_tenant_member(tenant_id))',
      v_table_name || '_tenant_delete',
      qualified_name
    );
  end loop;
end $$;
