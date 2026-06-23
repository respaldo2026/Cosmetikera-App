# SaaS en un solo Supabase: fases de implementación

## Fase 1 (lista en repo)

Incluye:

- Migración core SaaS: tenants + tenant_memberships + funciones SQL base.
- Seed inicial de tenant principal y membresías para usuarios existentes.
- Helper backend para resolver tenant activo por request.

Archivos:

- supabase/migrations/202606230001_saas_phase1_core.sql
- src/app/api/_utils/tenant-resolver.ts

### Ejecutar Fase 1

1. Ejecutar migración:
- npx supabase db push

2. Verificar en Supabase:
- Tabla tenants
- Tabla tenant_memberships
- Funciones public.current_tenant_slug, public.current_tenant_id, public.is_tenant_member, public.is_tenant_admin

3. Verificar seed:
- Tenant con slug principal
- Membresías para usuarios de auth.users

## Fase 2 (siguiente)

Objetivo: añadir tenant_id a tablas de negocio sin romper.

Tablas candidatas iniciales:

- perfiles
- articulos
- ventas
- compras
- movimientos_financieros
- configuracion

Estrategia:

1. Agregar tenant_id nullable + índices.
2. Backfill tenant_id = id de principal.
3. Actualizar endpoints para escribir siempre tenant_id nuevo.
4. En lecturas, empezar a filtrar por tenant_id.

## Fase 3 (siguiente)

Objetivo: aislamiento total.

1. Hacer tenant_id NOT NULL en tablas críticas.
2. Activar políticas RLS por tenant en tablas de negocio.
3. Auditar endpoints con service role para filtrar por tenant_id en todos los queries.
4. Pruebas de fuga cruzada entre tenants.

## Nota importante

En esta etapa todavía no se tocaron tablas operativas actuales para evitar impacto en producción.
