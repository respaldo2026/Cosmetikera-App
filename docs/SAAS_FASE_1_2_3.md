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

Estado actual:

- Migración creada: `supabase/migrations/202606230002_saas_phase2_tenant_columns.sql`
- Endpoints críticos ya adaptados con filtro por tenant:
	- `src/app/api/articulos/route.ts`
	- `src/app/api/perfiles/route.ts`
	- `src/app/api/historial/route.ts`
	- `src/app/api/club/puntos/route.ts`
	- `src/app/api/club/canjes/route.ts`
	- `src/app/api/club/referido/route.ts`
	- `src/app/api/club/route.ts`
	- `src/app/api/whatsapp/club-recipients/route.ts`

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

### Verificación de Fase 2 (obligatoria)

1. Confirmar columnas tenant_id en tablas:
- perfiles
- articulos
- ventas
- compras
- movimientos_financieros
- configuracion
- puntos_historial
- canjes

2. Confirmar backfill:
- `select count(*) from public.perfiles where tenant_id is null;` debe ser 0
- Repetir para tablas críticas

3. Confirmar endpoints ya aislados:
- `src/app/api/articulos/route.ts`
- `src/app/api/perfiles/route.ts`
- `src/app/api/historial/route.ts`

4. Probar manualmente con dos tenants:
- Crear artículo en tenant A y validar que no aparece en tenant B
- Crear cliente en tenant A y validar que historial de tenant B no lo devuelve

5. Si la migración muestra notice de duplicados en referencia de artículos:
- Limpiar duplicados por tenant
- Luego crear índice único `uq_articulos_tenant_referencia`

## Fase 3 (siguiente)

Objetivo: aislamiento total.

1. Hacer tenant_id NOT NULL en tablas críticas.
2. Activar políticas RLS por tenant en tablas de negocio.
3. Auditar endpoints con service role para filtrar por tenant_id en todos los queries.
4. Pruebas de fuga cruzada entre tenants.

## Nota importante

En esta etapa todavía no se tocaron tablas operativas actuales para evitar impacto en producción.
