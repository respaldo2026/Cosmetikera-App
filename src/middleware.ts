import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { extractTenantFromPathname, getDefaultTenantSlug, normalizeTenantSlug } from '@/utils/tenant/tenant-context'
import { getTenantSupabaseConfig } from '@/utils/supabase/tenant-config'

export async function middleware(request: NextRequest) {
  const tenantFromPath = extractTenantFromPathname(request.nextUrl.pathname)
  const tenantFromCookie = request.cookies.get('lc_tenant')?.value
  const tenant = normalizeTenantSlug(tenantFromPath ?? tenantFromCookie ?? getDefaultTenantSlug())
  const tenantConfig = getTenantSupabaseConfig(tenant)

  // 1. Crear una respuesta inicial que permite continuar
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })
  response.cookies.set('lc_tenant', tenant, { path: '/', sameSite: 'lax' })

  if (!tenantConfig.url || !tenantConfig.anonKey) {
    console.error(`[middleware] Supabase no configurado para tenant '${tenant}'`)
    return response
  }

  // 2. Cliente Supabase (Lógica integrada para manejar cookies)
  const supabase = createServerClient(
    tenantConfig.url,
    tenantConfig.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: any[]) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set('lc_tenant', tenant, { path: '/', sameSite: 'lax' })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 3. Refrescar sesión
  // Esto mantiene al usuario logueado pero NO bloquea ni redirige.
  // Es la configuración más permisiva ("Puertas Abiertas").
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    // Aplica a todas las rutas excepto archivos estáticos, imágenes y manifest
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json|webmanifest)$).*)',
  ],
}