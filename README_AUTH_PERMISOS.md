# Flujos de Autenticación y Permisos — Academia Crystal

## Autenticación
- **Cliente:**
  - Login con email/cédula (contraseña = cédula).
  - Redirección automática según rol (`profesor`, `estudiante`, `admin`, etc.).
  - Logout y verificación de sesión vía Supabase.
- **Servidor:**
  - Validación de sesión con cookies (Next.js middleware y server helpers).
  - En desarrollo, autenticación siempre permitida para facilitar pruebas.
- **Middleware:**
  - Refresca sesión en cada request.
  - Redirige a `/login` si no hay sesión y la ruta no es pública.

## Permisos y Roles
- **Definición:**
  - Los roles (`director`, `administrador`, `profesor`, `estudiante`, etc.) se definen en la tabla `perfiles` y en la tabla `role_permissions` de Supabase.
  - Los permisos por módulo se gestionan en la tabla `role_permissions` y se consumen desde el contexto global `RolesPermissionsProvider`.
- **Uso en la app:**
  - El contexto `RolesPermissionsProvider` expone hooks para consultar y modificar permisos por rol.
  - Los componentes pueden usar `useRolesPermissions()` para verificar permisos y condicionar la UI.

## Ejemplo de uso
```tsx
import { useRolesPermissions } from "@contexts/roles-permissions-context";

const { tienePermiso } = useRolesPermissions();

if (tienePermiso(user.rol, "tesoreria")) {
  // Mostrar módulo de tesorería
}
```

## Seguridad
- **Variables sensibles:**
  - Las claves de Supabase y otros secretos deben ir en variables de entorno (`.env.local`), nunca hardcodeadas.
  - Ejemplo:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=...
    NEXT_PUBLIC_SUPABASE_ANON_KEY=...
    ```
- **Revisión de RLS:**
  - Las políticas de Row Level Security (RLS) en Supabase deben estar activas y correctamente configuradas para cada tabla sensible.

---

> Actualiza este documento si cambian los flujos de auth o la lógica de permisos.
