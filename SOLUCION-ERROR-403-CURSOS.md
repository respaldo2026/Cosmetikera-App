# 🔧 Solución Error 403 al Crear Grupos

## Problema
No puedes crear grupos y sale este error:
```
xqcsftjkvcrbcetrdulq.supabase.co/rest/v1/cursos?select=*:1
Failed to load resource: the server responded with a status of 403
```

## Causa
Las políticas RLS (Row Level Security) de Supabase están bloqueando la inserción en la tabla `cursos`. Solo permite crear grupos a usuarios con rol `admin`, `director` o `administrativo`.

## Solución Inmediata ⚡

### Opción 1: Ejecutar SQL (RECOMENDADO)

1. Abre tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Ve a **SQL Editor**
3. Copia y pega el contenido del archivo: **`EJECUTAR-AHORA-FIX-CURSOS.sql`**
4. Haz clic en **Run** (▶️)
5. Deberías ver: ✅ "Política actualizada. Ahora puedes crear grupos sin problemas."
6. Regresa a la aplicación y intenta crear el grupo nuevamente

### Opción 2: Asignar Rol de Admin

Si prefieres mantener las políticas restrictivas y solo dar permiso a tu usuario:

```sql
-- Reemplaza 'tu-email@ejemplo.com' con tu correo real
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"rol": "admin"}'::jsonb
WHERE email = 'tu-email@ejemplo.com';

UPDATE perfiles
SET rol = 'admin'
WHERE email = 'tu-email@ejemplo.com';
```

Luego cierra sesión y vuelve a iniciar sesión en la app.

## Scripts Disponibles

1. **`EJECUTAR-AHORA-FIX-CURSOS.sql`** - Solución rápida (5 segundos)
2. **`FIX-PERMISOS-CURSOS-2026-02-12.sql`** - Solución completa con diagnóstico

## Verificar que Funcionó

Después de ejecutar el script:

1. Recarga la página de crear grupo
2. Intenta crear un grupo
3. Debería guardarse sin problemas
4. Si aún falla, revisa la consola del navegador (F12) para ver el error específico

## Restaurar Permisos Restrictivos (Opcional)

Si después quieres que solo los admins puedan crear grupos:

```sql
DROP POLICY IF EXISTS "cursos_insert_all_auth" ON cursos;

CREATE POLICY "cursos_insert" ON cursos
  FOR INSERT
  WITH CHECK (
    coalesce(
      auth.jwt()->'app_metadata'->>'rol',
      auth.jwt()->>'rol',
      auth.jwt()->>'role'
    ) IN ('admin', 'director', 'administrativo')
  );
```

## Notas

- La Opción 1 permite a **todos** los usuarios autenticados crear grupos
- La Opción 2 solo da permiso a **usuarios específicos** con rol admin
- Las demás operaciones (ver, editar, eliminar) siguen respetando sus políticas RLS
