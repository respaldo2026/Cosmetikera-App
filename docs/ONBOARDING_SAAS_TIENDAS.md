# Onboarding SaaS de Nuevas Tiendas

## Objetivo
Permitir que una tienda nueva cree su cuenta de forma autoservicio y quede lista para usar el sistema.

## Flujo implementado
1. El usuario entra a `/onboarding`.
2. Completa:
   - Nombre de tienda
   - Slug de tienda
   - Nombre del dueño/admin
   - Email admin
   - Teléfono (opcional)
   - Contraseña
3. El frontend llama a `POST /api/saas/onboard`.
4. El backend:
   - crea el tenant en `public.tenants`
   - crea el usuario en `auth.users`
   - crea membership owner en `public.tenant_memberships`
   - crea/actualiza perfil en `public.perfiles` con `tenant_id`
   - setea cookie `lc_tenant`
5. Se redirige a `/login` para iniciar sesión con el usuario creado.

## Archivos clave
- `src/app/onboarding/page.tsx`
- `src/app/api/saas/onboard/route.ts`
- `src/app/login/page.tsx` (enlace a onboarding)

## Seguridad
- Este flujo usa `SUPABASE_SERVICE_ROLE_KEY` en servidor.
- Se puede deshabilitar con `SAAS_ONBOARDING_ENABLED=false`.

## Variables requeridas
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- Opcional: `SAAS_ONBOARDING_ENABLED`

## Recomendado para producción
- Agregar captcha/rate-limit al endpoint de onboarding.
- Agregar verificación de dominio/correo de negocio para reducir abuso.
- Enviar email de bienvenida con enlaces de configuración inicial.
- Crear wizard de primer uso para completar branding, medios de pago y POS.
