-- ================================================
-- DATOS DE PRUEBA - ACADEMIA CRYSTAL DIAMANTE
-- ================================================
-- Ejecuta este script en Supabase SQL Editor
-- ================================================

-- 1. PERFILES (Profesores y Estudiantes)
-- Nota: Los IDs son UUIDs, ajusta según tu auth.users si es necesario
INSERT INTO perfiles (id, nombre_completo, email, telefono, identificacion, direccion, rol, valor_hora)
VALUES
-- Profesores
('11111111-1111-1111-1111-111111111111', 'Ana María García', 'ana.garcia@academy.com', '3001234567', '1234567890', 'Calle 10 #20-30', 'profesor', 50000),
('22222222-2222-2222-2222-222222222222', 'Carlos Rodríguez López', 'carlos.rodriguez@academy.com', '3009876543', '0987654321', 'Carrera 15 #30-40', 'profesor', 60000),
('33333333-3333-3333-3333-333333333333', 'María Isabel Pérez', 'maria.perez@academy.com', '3005555555', '5555555555', 'Avenida 20 #50-60', 'profesor', 70000),
-- Estudiantes
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Juan David Martínez', 'juan.martinez@student.com', '3101111111', '1010101010', 'Calle 5 #10-15', 'estudiante', NULL),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Laura Sofía Gómez', 'laura.gomez@student.com', '3102222222', '2020202020', 'Carrera 8 #12-18', 'estudiante', NULL),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Andrés Felipe Torres', 'andres.torres@student.com', '3103333333', '3030303030', 'Avenida 12 #25-35', 'estudiante', NULL),
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Carolina Ramírez Díaz', 'carolina.ramirez@student.com', '3104444444', '4040404040', 'Calle 18 #30-42', 'estudiante', NULL),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Santiago Vargas Ruiz', 'santiago.vargas@student.com', '3105555555', '5050505050', 'Carrera 22 #40-50', 'estudiante', NULL),
('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Valentina Castro Mora', 'valentina.castro@student.com', '3106666666', '6060606060', 'Avenida 30 #55-65', 'estudiante', NULL)
ON CONFLICT (id) DO NOTHING;

-- 1.1 PROFESORES INFO (especialidades)
INSERT INTO profesores_info (perfil_id, especialidad, valor_hora)
VALUES
('11111111-1111-1111-1111-111111111111', 'Inglés Avanzado', 50000),
('22222222-2222-2222-2222-222222222222', 'Matemáticas', 60000),
('33333333-3333-3333-3333-333333333333', 'Programación Web', 70000)
ON CONFLICT (perfil_id) DO NOTHING;

-- 2. CONFIGURACIÓN
INSERT INTO configuracion (id, nombre_academia, nit, direccion, telefono, email, ciudad, moneda, mensaje_factura, sitio_web, instagram)
VALUES
('99999999-9999-9999-9999-999999999999', 'Academia Crystal Diamante', '900123456-7', 'Calle Principal #45-67', '6011234567', 'info@crystaldiamond.edu.co', 'Bogotá', 'COP', 'Gracias por confiar en nosotros', 'https://crystaldiamond.edu.co', '@crystaldiamond')
ON CONFLICT (id) DO UPDATE SET
nombre_academia = EXCLUDED.nombre_academia,
nit = EXCLUDED.nit;

-- 3. CURSOS (especificando IDs explícitamente)
INSERT INTO cursos (id, nombre, descripcion, profesor_id, duracion, duracion_horas, horario, precio, precio_inscripcion, precio_mensualidad, cupos, estado, fecha_inicio, fecha_fin, porcentaje_minimo, porcentaje_comision, total_clases)
VALUES
(1, 'Inglés Básico A1', 'Curso introductorio de inglés con enfoque conversacional', '11111111-1111-1111-1111-111111111111', '3 meses', 48, 'Lunes y Miércoles 6:00 PM - 8:00 PM', 600000, 100000, 200000, 20, 'activo', '2025-01-15', '2025-04-15', 80, 10, 24),
(2, 'Matemáticas Nivel Medio', 'Álgebra, geometría y trigonometría para bachillerato', '22222222-2222-2222-2222-222222222222', '4 meses', 64, 'Martes y Jueves 4:00 PM - 6:00 PM', 800000, 120000, 220000, 15, 'activo', '2025-01-20', '2025-05-20', 75, 12, 32),
(3, 'Desarrollo Web Full Stack', 'HTML, CSS, JavaScript, React y Node.js', '33333333-3333-3333-3333-333333333333', '6 meses', 96, 'Sábados 9:00 AM - 1:00 PM', 1500000, 200000, 250000, 12, 'activo', '2025-02-01', '2025-08-01', 85, 15, 24),
(4, 'Inglés Intermedio B1', 'Continuación de nivel básico con gramática avanzada', '11111111-1111-1111-1111-111111111111', '3 meses', 48, 'Viernes 6:00 PM - 8:00 PM', 650000, 100000, 220000, 18, 'activo', '2025-02-10', '2025-05-10', 80, 10, 24),
(5, 'Python para Principiantes', 'Programación en Python desde cero', '33333333-3333-3333-3333-333333333333', '2 meses', 32, 'Miércoles 7:00 PM - 9:00 PM', 500000, 80000, 210000, 15, 'activo', '2025-01-25', '2025-03-25', 80, 12, 16),
(6, 'Cálculo Diferencial', 'Límites, derivadas y aplicaciones', '22222222-2222-2222-2222-222222222222', '5 meses', 80, 'Lunes y Viernes 5:00 PM - 7:00 PM', 900000, 150000, 200000, 12, 'proximo', '2025-03-01', '2025-08-01', 75, 12, 40)
ON CONFLICT (id) DO NOTHING;

-- 4. MATRÍCULAS (especificando IDs explícitamente)
INSERT INTO matriculas (id, estudiante_id, curso_id, estado, fecha_inicio, monto_pagado, deuda_pendiente, nota_final, estado_academico)
VALUES
-- Curso 1: Inglés Básico
(1, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'activo', '2025-01-15', 300000, 300000, NULL, 'cursando'),
(2, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1, 'activo', '2025-01-15', 600000, 0, NULL, 'cursando'),
(3, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 1, 'activo', '2025-01-15', 400000, 200000, NULL, 'cursando'),
-- Curso 2: Matemáticas
(4, 'dddddddd-dddd-dddd-dddd-dddddddddddd', 2, 'activo', '2025-01-20', 500000, 300000, NULL, 'cursando'),
(5, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 2, 'activo', '2025-01-20', 800000, 0, NULL, 'cursando'),
-- Curso 3: Desarrollo Web
(6, 'ffffffff-ffff-ffff-ffff-ffffffffffff', 3, 'activo', '2025-02-01', 700000, 800000, NULL, 'cursando'),
(7, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 3, 'activo', '2025-02-01', 1500000, 0, NULL, 'cursando'),
-- Curso 4: Inglés Intermedio
(8, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 4, 'activo', '2025-02-10', 350000, 300000, NULL, 'cursando'),
(9, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 4, 'activo', '2025-02-10', 650000, 0, NULL, 'cursando'),
-- Curso 5: Python
(10, 'dddddddd-dddd-dddd-dddd-dddddddddddd', 5, 'activo', '2025-01-25', 500000, 0, NULL, 'cursando'),
(11, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 5, 'activo', '2025-01-25', 290000, 210000, NULL, 'cursando'),
(12, 'ffffffff-ffff-ffff-ffff-ffffffffffff', 5, 'activo', '2025-01-25', 500000, 0, NULL, 'cursando')
ON CONFLICT (id) DO NOTHING;

-- 5. PAGOS
INSERT INTO pagos (estudiante_id, matricula_id, monto, metodo_pago, fecha_pago, observaciones, referencia)
VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 300000, 'transferencia', '2025-01-15', 'Inscripción + Primera mensualidad', 'COMP-001'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 2, 600000, 'efectivo', '2025-01-15', 'Pago completo del curso', 'COMP-002'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 3, 400000, 'tarjeta', '2025-01-16', 'Inscripción + Primera mensualidad', 'COMP-003'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', 4, 500000, 'transferencia', '2025-01-20', 'Inscripción + Primera mensualidad', 'COMP-004'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 5, 800000, 'efectivo', '2025-01-20', 'Pago completo', 'COMP-005'),
('ffffffff-ffff-ffff-ffff-ffffffffffff', 6, 700000, 'tarjeta', '2025-02-01', 'Inscripción + Primer mes', 'COMP-006'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 7, 1500000, 'transferencia', '2025-02-01', 'Pago completo del curso', 'COMP-007');

-- 6. TEMAS DEL CURSO
INSERT INTO temas_curso (curso_id, titulo, descripcion, orden)
VALUES
-- Inglés Básico
(1, 'Alfabeto y Pronunciación', 'Aprender el alfabeto inglés y fonética básica', 1),
(1, 'Saludos y Presentaciones', 'Cómo presentarse y saludar en inglés', 2),
(1, 'Números y Colores', 'Vocabulario básico de números y colores', 3),
(1, 'Presente Simple', 'Conjugación y uso del presente simple', 4),
-- Matemáticas
(2, 'Álgebra Básica', 'Operaciones algebraicas y ecuaciones lineales', 1),
(2, 'Geometría Plana', 'Figuras geométricas, perímetros y áreas', 2),
(2, 'Trigonometría', 'Razones trigonométricas y triángulos', 3),
-- Desarrollo Web
(3, 'Introducción a HTML', 'Estructura básica de una página web', 1),
(3, 'CSS y Diseño', 'Estilos, colores y diseño responsivo', 2),
(3, 'JavaScript Básico', 'Variables, funciones y DOM', 3),
(3, 'React Fundamentals', 'Componentes, props y state', 4),
(3, 'Node.js y Backend', 'Servidor, APIs y bases de datos', 5);

-- 7. SESIONES DE CLASE
INSERT INTO sesiones_clase (curso_id, profesor_id, fecha, horas_dictadas, tema_visto, estado_pago)
VALUES
-- Inglés Básico
(1, '11111111-1111-1111-1111-111111111111', '2025-01-15', 2, 'Alfabeto y Pronunciación', 'pagado'),
(1, '11111111-1111-1111-1111-111111111111', '2025-01-20', 2, 'Saludos y Presentaciones', 'pagado'),
(1, '11111111-1111-1111-1111-111111111111', '2025-01-22', 2, 'Números y Colores', 'pendiente'),
-- Matemáticas
(2, '22222222-2222-2222-2222-222222222222', '2025-01-20', 2, 'Álgebra Básica', 'pagado'),
(2, '22222222-2222-2222-2222-222222222222', '2025-01-23', 2, 'Ecuaciones Lineales', 'pagado'),
-- Desarrollo Web
(3, '33333333-3333-3333-3333-333333333333', '2025-02-01', 4, 'Introducción a HTML', 'pagado'),
(3, '33333333-3333-3333-3333-333333333333', '2025-02-08', 4, 'CSS y Diseño', 'pendiente');

-- 8. ASISTENCIAS (basadas en las matrículas existentes)
INSERT INTO asistencias (matricula_id, fecha, estado, observaciones)
VALUES
-- Curso 1: Inglés Básico (matriculas 1, 2, 3)
(1, '2025-01-15', 'presente', 'Primera clase'),
(2, '2025-01-15', 'presente', 'Primera clase'),
(3, '2025-01-15', 'ausente', 'Justificó por enfermedad'),
(1, '2025-01-20', 'presente', NULL),
(2, '2025-01-20', 'presente', NULL),
(3, '2025-01-20', 'presente', NULL),
(1, '2025-01-22', 'presente', NULL),
(2, '2025-01-22', 'ausente', 'Sin justificar'),
(3, '2025-01-22', 'presente', NULL),
-- Curso 2: Matemáticas (matriculas 4, 5)
(4, '2025-01-20', 'presente', 'Primera clase'),
(5, '2025-01-20', 'presente', 'Primera clase'),
(4, '2025-01-23', 'presente', NULL),
(5, '2025-01-23', 'presente', NULL),
-- Curso 3: Desarrollo Web (matriculas 6, 7)
(6, '2025-02-01', 'presente', 'Primera clase'),
(7, '2025-02-01', 'presente', 'Primera clase');

-- 9. INVENTARIO
INSERT INTO inventario (nombre_producto, descripcion, cantidad_stock, precio_costo, unidad_medida, categoria, stock_minimo)
VALUES
('Marcadores Borrables', 'Marcadores para tablero acrílico', 50, 3000, 'unidad', 'papeleria', 20),
('Resma Papel Carta', 'Papel bond blanco tamaño carta', 30, 15000, 'resma', 'papeleria', 10),
('Borrador Tablero', 'Borrador magnético para tablero', 15, 8000, 'unidad', 'papeleria', 5),
('Computador Portátil', 'Laptop para estudiantes', 8, 2500000, 'unidad', 'equipos', 2),
('Mouse Inalámbrico', 'Mouse para computador', 25, 35000, 'unidad', 'equipos', 10),
('Libro Inglés A1', 'Libro de texto nivel básico', 40, 50000, 'unidad', 'libros', 15);

-- 10. PAGOS DE NÓMINA
INSERT INTO pagos_nomina (profesor_id, fecha_inicio_periodo, fecha_fin_periodo, fecha_pago, total_horas, total_pagado, observaciones)
VALUES
('11111111-1111-1111-1111-111111111111', '2025-01-01', '2025-01-15', '2025-01-15', 8, 400000, 'Quincena enero 1-15'),
('22222222-2222-2222-2222-222222222222', '2025-01-01', '2025-01-15', '2025-01-15', 6, 360000, 'Quincena enero 1-15'),
('33333333-3333-3333-3333-333333333333', '2025-02-01', '2025-02-08', '2025-02-08', 8, 560000, 'Semana feb 1-8');

-- ================================================
-- FIN DE DATOS DE PRUEBA
-- ================================================
-- Total registros insertados:
-- - 9 perfiles (3 profesores + 6 estudiantes)
-- - 6 cursos
-- - 12 matrículas
-- - 7 pagos
-- - 13 temas de curso
-- - 7 sesiones de clase
-- - 17 registros de asistencia
-- - 6 productos de inventario
-- - 3 pagos de nómina
-- ================================================
