-- ================================================
-- CREAR PROFESOR DE PRUEBA COMPLETO
-- ================================================
-- Crea un profesor con curso asignado para probar el flujo completo
-- ================================================

-- PASO 1: Crear el perfil del profesor
-- Nota: Ajusta el ID según tu necesidad o usa uno aleatorio
INSERT INTO perfiles (
    id, 
    nombre_completo, 
    email, 
    telefono, 
    identificacion, 
    rol, 
    valor_hora,
    direccion,
    created_at
) VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890', -- ID único (cámbialo si ya existe)
    'Ana María López García',
    'ana.lopez@academiacrystal.com',
    '+57 300 123 4567',
    '1234567890',
    'profesor',
    25000, -- Valor por hora: $25,000
    'Calle 123 #45-67, Bogotá',
    NOW()
) ON CONFLICT (id) DO UPDATE 
SET 
    nombre_completo = EXCLUDED.nombre_completo,
    email = EXCLUDED.email,
    rol = 'profesor',
    valor_hora = 25000;

-- PASO 2: Crear un curso y asignárselo
INSERT INTO cursos (
    nombre,
    descripcion,
    profesor_id,
    estado,
    duracion,
    duracion_horas,
    precio,
    precio_mensualidad,
    cupos,
    horario,
    fecha_inicio,
    fecha_fin,
    porcentaje_minimo,
    created_at
) VALUES (
    'Diseño de Uñas Avanzado - PRUEBA',
    'Curso de prueba para verificar flujo de registro de horas y nómina',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890', -- El profesor creado arriba
    'activo',
    '2 meses',
    40,
    800000,
    400000,
    10,
    'Martes y Jueves 2:00 PM - 5:00 PM',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '2 months',
    80,
    NOW()
) ON CONFLICT DO NOTHING;

-- PASO 3: Crear algunos estudiantes de prueba para el curso
INSERT INTO perfiles (
    id,
    nombre_completo,
    email,
    telefono,
    rol,
    created_at
) VALUES 
    ('estudiante-prueba-001', 'María Pérez', 'maria.perez@test.com', '+57 301 111 1111', 'estudiante', NOW()),
    ('estudiante-prueba-002', 'Laura Gómez', 'laura.gomez@test.com', '+57 302 222 2222', 'estudiante', NOW()),
    ('estudiante-prueba-003', 'Sandra Ruiz', 'sandra.ruiz@test.com', '+57 303 333 3333', 'estudiante', NOW())
ON CONFLICT (id) DO NOTHING;

-- PASO 4: Matricular los estudiantes al curso
INSERT INTO matriculas (
    estudiante_id,
    curso_id,
    estado,
    fecha_inicio,
    created_at
)
SELECT 
    p.id,
    c.id,
    'activo',
    CURRENT_DATE,
    NOW()
FROM perfiles p
CROSS JOIN cursos c
WHERE p.id IN ('estudiante-prueba-001', 'estudiante-prueba-002', 'estudiante-prueba-003')
  AND c.nombre = 'Diseño de Uñas Avanzado - PRUEBA'
ON CONFLICT DO NOTHING;

-- PASO 5: Crear algunos temas para el curso
INSERT INTO temas_curso (
    curso_id,
    titulo,
    descripcion,
    orden,
    created_at
)
SELECT 
    c.id,
    titulo,
    descripcion,
    orden,
    NOW()
FROM cursos c,
     (VALUES 
        ('Introducción al diseño', 'Conceptos básicos y herramientas', 1),
        ('Técnicas de color', 'Teoría del color aplicada', 2),
        ('Diseños 3D', 'Técnicas avanzadas de modelado', 3)
     ) AS temas(titulo, descripcion, orden)
WHERE c.nombre = 'Diseño de Uñas Avanzado - PRUEBA'
ON CONFLICT DO NOTHING;

-- ================================================
-- VERIFICACIÓN
-- ================================================

-- Ver el profesor creado
SELECT 
    id,
    nombre_completo,
    email,
    rol,
    valor_hora,
    telefono
FROM perfiles 
WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- Ver el curso asignado
SELECT 
    c.id,
    c.nombre,
    c.estado,
    p.nombre_completo as profesor,
    COUNT(m.id) as total_estudiantes
FROM cursos c
LEFT JOIN perfiles p ON c.profesor_id = p.id
LEFT JOIN matriculas m ON c.id = m.curso_id AND m.estado = 'activo'
WHERE c.nombre = 'Diseño de Uñas Avanzado - PRUEBA'
GROUP BY c.id, c.nombre, c.estado, p.nombre_completo;

-- Ver estudiantes matriculados
SELECT 
    p.nombre_completo,
    p.email,
    m.estado as estado_matricula,
    c.nombre as curso
FROM matriculas m
JOIN perfiles p ON m.estudiante_id = p.id
JOIN cursos c ON m.curso_id = c.id
WHERE c.nombre = 'Diseño de Uñas Avanzado - PRUEBA';

-- ================================================
-- IMPORTANTE: CREAR USUARIO EN AUTH
-- ================================================
-- Para que el profesor pueda iniciar sesión, debes:
-- 1. Ir a Supabase Dashboard > Authentication > Users
-- 2. Click en "Add user" > "Create new user"
-- 3. Usar estos datos:
--    Email: ana.lopez@academiacrystal.com
--    Password: Profesor123! (o la que prefieras)
--    User UID: a1b2c3d4-e5f6-7890-abcd-ef1234567890 (el mismo ID del perfil)
-- 4. Confirmar email automáticamente
-- 
-- O ejecutar este INSERT directo (requiere permisos de servicio):
-- INSERT INTO auth.users (
--     id,
--     email,
--     encrypted_password,
--     email_confirmed_at,
--     created_at,
--     updated_at,
--     raw_app_meta_data,
--     raw_user_meta_data,
--     is_super_admin,
--     role
-- ) VALUES (
--     'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
--     'ana.lopez@academiacrystal.com',
--     crypt('Profesor123!', gen_salt('bf')),
--     NOW(),
--     NOW(),
--     NOW(),
--     '{"provider":"email","providers":["email"]}',
--     '{}',
--     false,
--     'authenticated'
-- );
-- ================================================
