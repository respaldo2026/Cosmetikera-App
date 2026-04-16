# 🚨 PASOS RÁPIDOS - Administradores no aparecen

## EJECUTA ESTOS 3 SCRIPTS EN ORDEN:

### 1️⃣ DIAGNÓSTICO (para ver qué está pasando)
Archivo: `diagnostico-administradores.sql`
- Abre Supabase → SQL Editor
- Copia y pega el contenido completo
- Click **Run** o `Ctrl+Enter`
- **IMPORTANTE**: Anota los resultados (cuántos admins hay, si están confirmados, etc.)

### 2️⃣ CONFIRMAR EMAILS (si hay admins sin confirmar)
Archivo: `fix-confirmar-emails-admin.sql`
- Abre Supabase → SQL Editor
- Copia y pega el contenido completo
- Click **Run** o `Ctrl+Enter`
- Debe mostrar los admins confirmados

### 3️⃣ ARREGLAR PERMISOS RLS (si aún no aparecen)
Archivo: `fix-rls-perfiles-admin.sql`
- Abre Supabase → SQL Editor
- Copia y pega el contenido completo
- Click **Run** o `Ctrl+Enter`
- Esto desactiva RLS temporalmente para perfiles

## DESPUÉS DE EJECUTAR:
1. Ve a tu app: http://localhost:3001/configuracion/administradores
2. Presiona `F12` para abrir la consola
3. Recarga la página (`Ctrl+R`)
4. Mira los logs en la consola (deben mostrar cuántos admins encontró)

## SI AÚN NO APARECEN:
Copia los logs de la consola y el resultado de `diagnostico-administradores.sql` para ayudarte mejor.

## ALTERNATIVA RÁPIDA (Crear nuevo admin directamente en Supabase):
1. Supabase → SQL Editor
2. Ejecuta:
```sql
-- Crear admin de prueba con email confirmado
INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role,
    aud
)
VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'admin@test.com',
    crypt('12345678', gen_salt('bf')),
    NOW(), -- ✅ Email confirmado
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"nombre_completo":"Admin Test"}',
    FALSE,
    'authenticated',
    'authenticated'
)
RETURNING id;

-- Copiar el ID que te devuelve y úsalo aquí:
INSERT INTO perfiles (
    id,
    nombre_completo,
    email,
    rol,
    identificacion
)
VALUES (
    'PEGA-AQUI-EL-ID', -- ⚠️ Reemplazar con el ID de arriba
    'Admin Test',
    'admin@test.com',
    'admin',
    '12345678'
);
```

Login con:
- Email: `admin@test.com`
- Contraseña: `12345678`
