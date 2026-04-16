-- ========================================
-- CONFIRMAR EMAILS DE ADMINISTRADORES DE PRUEBA
-- ========================================
-- Este script confirma automáticamente los emails de los administradores
-- que están en estado pendiente (email_confirmed_at IS NULL)

-- Ver administradores pendientes de confirmación
SELECT 
    u.id,
    u.email,
    u.email_confirmed_at,
    u.created_at,
    p.nombre_completo,
    p.rol
FROM auth.users u
LEFT JOIN perfiles p ON p.id = u.id
WHERE p.rol = 'admin'
  AND u.email_confirmed_at IS NULL
ORDER BY u.created_at DESC;

-- Confirmar emails automáticamente para administradores
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

-- Verificar que se confirmaron
SELECT 
    u.id,
    u.email,
    u.email_confirmed_at,
    u.created_at,
    p.nombre_completo,
    p.rol
FROM auth.users u
LEFT JOIN perfiles p ON p.id = u.id
WHERE p.rol = 'admin'
ORDER BY u.created_at DESC;
