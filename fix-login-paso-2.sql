-- PASO 2: Ver administradores en perfiles
SELECT 
    id,
    nombre_completo,
    email,
    rol,
    created_at
FROM perfiles
WHERE rol = 'administrador'
ORDER BY created_at DESC;
