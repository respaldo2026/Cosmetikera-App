# ⚠️ SOLUCIÓN: Administradores no aparecen (emails no confirmados)

## Problema
Los administradores creados desde la interfaz no aparecen en la lista porque sus emails están pendientes de confirmación. Al usar emails de prueba (ej: `admin@test.com`, `usuario@prueba.com`), no se puede confirmar el email mediante el enlace enviado.

## Soluciones

### Opción 1: Script SQL Automático (RECOMENDADO)
Ejecuta el archivo `fix-confirmar-emails-admin.sql` en el SQL Editor de Supabase:

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Abre: **SQL Editor**
3. Copia y pega el contenido de `fix-confirmar-emails-admin.sql`
4. Click en **Run** o presiona `Ctrl+Enter`
5. Verifica en la tabla de resultados que los emails fueron confirmados

```sql
-- Vista rápida del script:
UPDATE auth.users
SET 
    email_confirmed_at = NOW(),
    updated_at = NOW()
WHERE id IN (
    SELECT u.id
    FROM auth.users u
    INNER JOIN perfiles p ON p.id = u.id
    WHERE p.rol = 'admin'
      AND u.email_confirmed_at IS NULL
);
```

### Opción 2: Confirmar Manualmente desde Supabase
Para cada administrador:

1. Ve a: **Authentication → Users**
2. Busca el usuario por email
3. Click en el usuario
4. En el panel derecho, busca "Email Confirmed"
5. Click en **Confirm email**

### Opción 3: Desactivar confirmación de email (solo desarrollo)
Si estás en desarrollo y quieres que todos los usuarios se auto-confirmen:

1. Ve a: **Authentication → Settings**
2. Busca: **Email Confirmations**
3. Desactiva: **Enable email confirmations**

⚠️ **ADVERTENCIA**: Esto afecta a TODOS los usuarios. Úsalo solo en desarrollo.

## Prevención Futura

### Al crear nuevos administradores:
1. Después de crear el usuario en la interfaz
2. Ejecuta inmediatamente: `fix-confirmar-emails-admin.sql`
3. Refresca la página de administradores

### Usando emails reales:
Si usas emails reales que puedes acceder:
1. El usuario recibirá un email de confirmación
2. Click en el enlace del email
3. El email se confirmará automáticamente
4. El usuario aparecerá en la lista

## Verificación
Para verificar que los emails están confirmados, ejecuta en Supabase SQL Editor:

```sql
SELECT 
    u.email,
    u.email_confirmed_at,
    CASE 
        WHEN u.email_confirmed_at IS NULL THEN '❌ Pendiente'
        ELSE '✅ Confirmado'
    END as estado,
    p.nombre_completo,
    p.rol
FROM auth.users u
LEFT JOIN perfiles p ON p.id = u.id
WHERE p.rol = 'admin'
ORDER BY u.created_at DESC;
```

## Archivos Relacionados
- `fix-confirmar-emails-admin.sql` - Script para confirmar emails automáticamente
- `src/app/configuracion/administradores/page.tsx` - Interfaz de gestión de administradores
- `crear-admin-simple.sql` - Ejemplo de cómo crear admin con email pre-confirmado

---
**Fecha**: 2026-01-14
**Categoría**: Configuración / Autenticación
