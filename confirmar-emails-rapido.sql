-- ========================================
-- CONFIRMAR AUTOMÁTICAMENTE EMAILS NUEVOS
-- ========================================
-- Ejecuta esto DESPUÉS de crear usuarios desde la interfaz
-- para que aparezcan inmediatamente en las listas

-- Confirmar todos los emails sin confirmar
UPDATE auth.users
SET 
    email_confirmed_at = NOW(),
    updated_at = NOW()
WHERE email_confirmed_at IS NULL;

-- Ver resultado
SELECT 
    u.id,
    u.email,
    u.email_confirmed_at as "Email Confirmado",
    u.created_at as "Creado",
    p.nombre_completo,
    p.rol
FROM auth.users u
LEFT JOIN perfiles p ON p.id = u.id
ORDER BY u.created_at DESC
LIMIT 20;
