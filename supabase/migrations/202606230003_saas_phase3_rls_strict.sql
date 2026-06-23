-- =====================================================
-- SaaS Fase 3
-- RLS estricto por tenant en tablas operativas
-- =====================================================

-- Tenant efectivo para RLS:
-- 1) tenant del JWT (cuando exista claim tenant_slug)
-- 2) tenant por defecto del usuario en tenant_memberships
-- 3) primera membresia del usuario
-- 4) fallback a tenant principal para compatibilidad
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
      limit 1
    ),
    (
      select tm.tenant_id
      from public.tenant_memberships tm
      where tm.user_id = auth.uid()
      order by tm.created_at asc
      limit 1
    ),
    public.get_default_tenant_id()
  );
$$;

-- Activa y aplica políticas RLS por tenant en tablas operativas.
do $$
declare
  v_table_name text;
  qualified_name text;
  has_tenant_id boolean;
  null_count bigint;
begin
  foreach v_table_name in array array[
    'perfiles',
    'articulos',
    'ventas',
    'compras',
    'movimientos_financieros',
    'configuracion',
    'club_reglas_config',
    'club_recompensas_config',
    'proveedores',
    'puntos_historial',
    'canjes',
    'club_inscripciones',
    'notificaciones_enviadas',
    'whatsapp_conversation_history',
    'whatsapp_customer_memory'
  ]
  loop
    qualified_name := format('public.%I', v_table_name);

    if to_regclass(qualified_name) is null then
      raise notice 'Tabla % no existe. Se omite en Fase 3.', qualified_name;
      continue;
    end if;

    select exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = v_table_name
        and c.column_name = 'tenant_id'
    ) into has_tenant_id;

    if not has_tenant_id then
      raise notice 'Tabla % no tiene tenant_id. Se omite RLS de Fase 3.', qualified_name;
      continue;
    end if;

    -- 1) Habilitar RLS
    execute format('alter table %s enable row level security', qualified_name);

    -- 2) Limpiar políticas previas para idempotencia
    execute format('drop policy if exists %I on %s', v_table_name || '_tenant_select', qualified_name);
    execute format('drop policy if exists %I on %s', v_table_name || '_tenant_insert', qualified_name);
    execute format('drop policy if exists %I on %s', v_table_name || '_tenant_update', qualified_name);
    execute format('drop policy if exists %I on %s', v_table_name || '_tenant_delete', qualified_name);

    -- 3) Políticas por tenant para usuarios autenticados
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

    -- 4) Endurecer nullability de forma progresiva (solo cuando no hay nulos)
    execute format('select count(*) from %s where tenant_id is null', qualified_name) into null_count;
    if null_count = 0 then
      execute format('alter table %s alter column tenant_id set not null', qualified_name);
    else
      raise notice 'Tabla % mantiene tenant_id nullable por % filas sin tenant_id.', qualified_name, null_count;
    end if;
  end loop;
end $$;

-- Recomendación operativa:
-- Tras desplegar esta migración, se recomienda emitir JWT con claim tenant_slug
-- para controlar tenant activo explícito por sesión; mientras tanto,
-- el RLS usa la membresía por defecto del usuario.
