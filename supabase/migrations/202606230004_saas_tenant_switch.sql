-- =====================================================
-- SaaS Fase 3.1
-- Cambio de tenant por defecto del usuario autenticado
-- =====================================================

create or replace function public.set_default_tenant(p_tenant_slug text)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  select t.id
  into v_tenant_id
  from public.tenants t
  join public.tenant_memberships tm on tm.tenant_id = t.id
  where t.slug = p_tenant_slug
    and t.estado = 'active'
    and tm.user_id = v_user_id
  limit 1;

  if v_tenant_id is null then
    raise exception 'Tenant no valido para este usuario: %', p_tenant_slug;
  end if;

  update public.tenant_memberships
  set is_default = false,
      updated_at = now()
  where user_id = v_user_id
    and is_default = true;

  update public.tenant_memberships
  set is_default = true,
      updated_at = now()
  where user_id = v_user_id
    and tenant_id = v_tenant_id;

  return v_tenant_id;
end;
$$;

grant execute on function public.set_default_tenant(text) to authenticated;
