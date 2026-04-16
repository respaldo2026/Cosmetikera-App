-- PASO 1: Ver usuarios en auth.users
SELECT 
    id,
    email,
    created_at,
    last_sign_in_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;
