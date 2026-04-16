-- PASO 3: Validar relación auth.users <-> perfiles
SELECT 
    u.id as user_id,
    u.email as auth_email,
    p.id as perfil_id,
    p.nombre_completo,
    p.rol,
    CASE 
        WHEN p.id IS NULL THEN 'SIN PERFIL'
        WHEN u.id = p.id THEN 'OK'
        ELSE 'MISMATCH'
    END as validacion
FROM auth.users u
LEFT JOIN perfiles p ON u.id = p.id
ORDER BY u.created_at DESC
LIMIT 10;
