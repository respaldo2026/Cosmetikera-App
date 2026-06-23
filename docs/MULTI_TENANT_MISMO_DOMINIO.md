# Multi-tienda en mismo dominio (BD/config separadas)

Objetivo: usar una sola app (mismo dominio), separando datos y configuración por tienda.

## Enfoque recomendado

1. Usar ruta por tenant: /t/{slug}
2. Resolver tenant desde URL/cookie/header
3. Cargar credenciales Supabase por tenant desde variables TENANT_{SLUG}_*
4. Mantener fallback a variables globales para compatibilidad

## Variables requeridas por tienda

Para cada tienda, define:

- TENANT_{SLUG}_SUPABASE_URL
- TENANT_{SLUG}_SUPABASE_ANON_KEY
- TENANT_{SLUG}_SUPABASE_SERVICE_ROLE_KEY

Ejemplo para slug tienda-norte (se transforma a TIENDA_NORTE):

- TENANT_TIENDA_NORTE_SUPABASE_URL
- TENANT_TIENDA_NORTE_SUPABASE_ANON_KEY
- TENANT_TIENDA_NORTE_SUPABASE_SERVICE_ROLE_KEY

Variables de default:

- NEXT_PUBLIC_DEFAULT_TENANT_SLUG
- DEFAULT_TENANT_SLUG

## Qué quedó implementado

- Resolución de tenant por path en middleware y cliente web.
- Cliente Supabase del frontend tenant-aware.
- Guard admin tenant-aware para rutas API que usan requireAdmin.
- Cookie lc_tenant para mantener contexto de tienda.

## Importante: endpoints pendientes

Todavía hay endpoints API que usan directamente NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.
Esos endpoints deben migrarse a un helper tenant-aware para aislamiento total.

Archivos críticos a migrar primero:

1. src/app/api/historial/route.ts
2. src/app/api/perfiles/route.ts
3. src/app/api/articulos/route.ts
4. src/app/api/club/**
5. src/app/api/whatsapp/**

## Plan de migración sugerido

1. Crear helper server único (por ejemplo src/utils/supabase/server-tenant.ts) para NextRequest.
2. Reemplazar createClient(...) directo en API routes por ese helper.
3. Validar flujo por tienda con pruebas manuales:
   - /t/principal/login
   - /t/tienda-norte/login
   - CRUD de artículos y ventas en ambas tiendas
4. Revisar branding/textos para que salgan desde tabla configuracion por tenant.

## Despliegue

1. Un solo deployment de Next.js
2. Un solo dominio (o subdominio principal)
3. Rutas por tienda bajo /t/{slug}
4. Variables TENANT_* cargadas en plataforma (Vercel/otro)

## Riesgos conocidos

- Si se navega entre tenants en la misma sesión del navegador, cerrar sesión y volver a entrar evita mezclar contexto.
- Si un endpoint no está migrado a tenant-aware, puede leer/escribir en la BD fallback.
