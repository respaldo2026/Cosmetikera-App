import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { extractTenantFromPathname, getDefaultTenantSlug, normalizeTenantSlug } from '@/utils/tenant/tenant-context'

export async function middleware(request: NextRequest) {
  const tenantFromPath = extractTenantFromPathname(request.nextUrl.pathname)
  const tenantFromCookie = request.cookies.get('lc_tenant')?.value
  const tenant = normalizeTenantSlug(tenantFromPath ?? tenantFromCookie ?? getDefaultTenantSlug())

  // 1. Crear una respuesta inicial que permite continuar
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })
  response.cookies.set('lc_tenant', tenant, { path: '/', sameSite: 'lax' })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[middleware] Supabase no configurado en variables públicas')
    return response
  }

  // 2. Cliente Supabase (Lógica integrada para manejar cookies)
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
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