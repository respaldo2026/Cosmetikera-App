import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 1. Crear una respuesta inicial que permite continuar
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // 2. Cliente Supabase (Lógica integrada para manejar cookies)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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