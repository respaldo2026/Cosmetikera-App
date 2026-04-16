-- ====================================================
-- DIAGNÓSTICO COMPLETO: Por qué no puedo borrar leads
-- ====================================================

-- 1️⃣ Verificar tu sesión actual
SELECT 
    '🔑 MI SESIÓN' as seccion,
    auth.uid() as mi_usuario_id,
    auth.role() as mi_rol_postgres,
    current_user as usuario_postgres;

-- 2️⃣ Verificar si tienes perfil
SELECT 
    '👤 MI PERFIL' as seccion,
    id,
    email,
    rol,
    nombre_completo,
    CASE 
        WHEN id IS NULL THEN '❌ NO TIENES PERFIL - Este es el problema'
        WHEN rol IS NULL THEN '❌ TU ROL ES NULL - Este es el problema'
        WHEN rol NOT IN ('admin', 'director', 'administrativo') THEN '❌ Tu rol "' || rol || '" no puede eliminar'
        ELSE '✅ Tu perfil está correcto'
    END as diagnostico
FROM perfiles
WHERE id = auth.uid();

-- 3️⃣ Ver TODOS los perfiles admin (para comparar)
SELECT 
    '📋 PERFILES ADMIN' as seccion,
    id,
    email,
    rol,
    nombre_completo
FROM perfiles
WHERE rol IN ('admin', 'director', 'administrativo')
ORDER BY rol, email
LIMIT 10;

-- 4️⃣ Verificar políticas de DELETE
SELECT 
    '🔒 POLÍTICA DELETE' as seccion,
    policyname,
    CASE 
        WHEN qual LIKE '%admin%' AND qual LIKE '%director%' AND qual LIKE '%administrativo%' THEN '✅ Política correcta'
        ELSE '❌ Política incorrecta'
    END as estado,
    qual as condicion
FROM pg_policies
WHERE tablename = 'leads' AND cmd = 'DELETE';

-- 5️⃣ Ver algunos leads para probar
SELECT 
    '📝 LEADS DISPONIBLES' as seccion,
    id,
    nombre,
    telefono,
    created_at
FROM leads
ORDER BY created_at DESC
LIMIT 5;

-- 6️⃣ PRUEBA MANUAL de eliminación
-- Descomentar y ejecutar con un ID real:
/*
DELETE FROM leads 
WHERE id = 'REEMPLAZAR-CON-ID-REAL';
*/

-- Si falla, copia el mensaje de error EXACTO aquí

-- ====================================================
-- 7️⃣ SOLUCIONES SEGÚN EL PROBLEMA
-- ====================================================

-- PROBLEMA A: No tienes perfil
-- SOLUCIÓN: Crear perfil
/*
INSERT INTO perfiles (id, email, rol, nombre_completo)
VALUES (
    auth.uid(),
    'TU-EMAIL@AQUI.COM',
    'admin',
    'Tu Nombre'
);
*/

-- PROBLEMA B: Tu rol es NULL o incorrecto
-- SOLUCIÓN: Actualizar rol
/*
UPDATE perfiles 
SET rol = 'admin'
WHERE id = auth.uid();
*/

-- PROBLEMA C: auth.uid() es NULL (no estás autenticado)
-- SOLUCIÓN: Cerrar sesión y volver a entrar en la app

-- ====================================================
-- RESULTADO ESPERADO:
-- Sección 1: Debe mostrar tu usuario ID
-- Sección 2: Debe mostrar tu perfil con rol 'admin', 'director' o 'administrativo'
-- Sección 3: Debe mostrar otros admins
-- Sección 4: Debe decir "✅ Política correcta"
-- Sección 5: Debe mostrar algunos leads
-- ====================================================
