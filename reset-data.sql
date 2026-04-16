-- =====================================================
-- SCRIPT DE REINICIO DE DATOS - ACADEMIA CRYSTAL
-- Elimina todos los datos existentes y crea datos de prueba
-- =====================================================

-- PASO 1: ELIMINAR TODOS LOS DATOS RELACIONADOS
-- IMPORTANTE: El orden de eliminación respeta las foreign keys

DELETE FROM calificaciones;

DELETE FROM asistencias;

DELETE FROM pagos;

-- Eliminar sesiones_clase (referencia a cursos)
DELETE FROM sesiones_clase;

DELETE FROM matriculas;

DELETE FROM cursos;

-- Eliminar programas (nivel superior) después de eliminar cursos
DELETE FROM programas;

-- Eliminar info adicional de profesores (FK a perfiles)
DELETE FROM profesores_info;

DELETE FROM perfiles WHERE rol IN ('estudiante', 'profesor');

-- =====================================================
-- PASO 2: CREAR 3 PROGRAMAS SUPERIORES
-- =====================================================

INSERT INTO programas (nombre, descripcion, duracion, duracion_horas, precio, precio_inscripcion, precio_mensualidad, activo)
VALUES
(
  'Artista Integral en Uñas',
  'Programa integral de manicure, pedicure, diseño de uñas y técnicas avanzadas de nail art',
  '4 meses',
  192,
  1400000,
  0,
  350000,
  true
),
(
  'Miradas Perfectas',
  'Diseño y aplicación de pestañas, cejas perfectas, laminado de cejas y pestañas',
  '3 meses',
  144,
  900000,
  0,
  300000,
  true
),
(
  'Maquillaje Profesional',
  'Maquillaje social, artístico, caracterización, técnicas de contorno, color y estilos para eventos',
  '3 meses',
  144,
  960000,
  0,
  320000,
  true
);

-- =====================================================
-- PASO 3: CREAR 3 GRUPOS (CURSOS) VINCULADOS A PROGRAMAS
-- =====================================================

INSERT INTO cursos (nombre, descripcion, duracion, duracion_horas, precio, precio_mensualidad, total_clases, porcentaje_minimo, estado, programa_id) VALUES
(
  'Artista Integral en Uñas',
  'Curso completo de manicure, pedicure, diseño de uñas, técnicas avanzadas de nail art y gestión de negocio de belleza',
  '4 meses',
  192,
  1400000,
  350000,
  48,
  80,
  'activo',
  (SELECT id FROM programas WHERE nombre = 'Artista Integral en Uñas')
),
(
  'Miradas Perfectas',
  'Técnicas profesionales de diseño y aplicación de pestañas, cejas perfectas, laminado de cejas y pestañas',
  '3 meses',
  144,
  900000,
  300000,
  36,
  80,
  'activo',
  (SELECT id FROM programas WHERE nombre = 'Miradas Perfectas')
),
(
  'Maquillaje Profesional',
  'Maquillaje social, artístico, caracterización, técnicas de contorno, color y estilos para eventos',
  '3 meses',
  144,
  960000,
  320000,
  36,
  80,
  'activo',
  (SELECT id FROM programas WHERE nombre = 'Maquillaje Profesional')
);

-- =====================================================
-- PASO 3: CREAR 3 PROFESORES DE PRUEBA
-- =====================================================

INSERT INTO perfiles (nombre_completo, email, telefono, direccion, fecha_nacimiento, rol) VALUES
(
  'Martha Cristina Rodríguez',
  'martha.rodriguez@academia-crystal.com',
  '3201234567',
  'Calle 45 #23-10, Bogotá',
  '1985-03-15',
  'profesor'
),
(
  'Diana Carolina López',
  'diana.lopez@academia-crystal.com',
  '3109876543',
  'Carrera 30 #12-45, Bogotá',
  '1990-07-22',
  'profesor'
),
(
  'Laura Marcela Gómez',
  'laura.gomez@academia-crystal.com',
  '3156543210',
  'Avenida 68 #80-23, Bogotá',
  '1988-11-08',
  'profesor'
);

-- =====================================================
-- PASO 4: CREAR 6 ESTUDIANTES DE PRUEBA
-- =====================================================

INSERT INTO perfiles (nombre_completo, email, telefono, direccion, fecha_nacimiento, identificacion, rol) VALUES
(
  'Estudiante de Prueba 1',
  'est1@prueba.com',
  '3000000001',
  'Dirección de prueba 1',
  '2000-01-01',
  '1000000001',
  'estudiante'
),
(
  'Estudiante de Prueba 2',
  'est2@prueba.com',
  '3000000002',
  'Dirección de prueba 2',
  '2000-02-02',
  '1000000002',
  'estudiante'
),
(
  'Estudiante de Prueba 3',
  'est3@prueba.com',
  '3000000003',
  'Dirección de prueba 3',
  '2000-03-03',
  '1000000003',
  'estudiante'
),
(
  'Estudiante de Prueba 4',
  'est4@prueba.com',
  '3000000004',
  'Dirección de prueba 4',
  '2000-04-04',
  '1000000004',
  'estudiante'
),
(
  'Estudiante de Prueba 5',
  'est5@prueba.com',
  '3000000005',
  'Dirección de prueba 5',
  '2000-05-05',
  '1000000005',
  'estudiante'
),
(
  'Estudiante de Prueba 6',
  'est6@prueba.com',
  '3000000006',
  'Dirección de prueba 6',
  '2000-06-06',
  '1000000006',
  'estudiante'
);

-- =====================================================
-- PASO 5: CREAR EJEMPLOS DE PAGOS (TESORERÍA)
-- =====================================================

-- Nota: Los IDs de matrícula y estudiante deben existir
-- Se crean pagos de ejemplo con diferentes métodos
INSERT INTO pagos (estudiante_id, matricula_id, monto, metodo_pago, fecha_pago, observaciones, referencia)
VALUES
-- Efectivo
(
  (SELECT perfiles.id FROM perfiles WHERE nombre_completo = 'Valentina Martínez Pérez' LIMIT 1),
  (SELECT matriculas.id FROM matriculas LIMIT 1),
  350000,
  'Efectivo',
  CURRENT_DATE,
  'Pago mensualidad enero',
  'EFE-001'
),
-- Nequi
(
  (SELECT perfiles.id FROM perfiles WHERE nombre_completo = 'Camila Andrea Torres' LIMIT 1),
  (SELECT matriculas.id FROM matriculas LIMIT 1),
  300000,
  'Nequi',
  CURRENT_DATE,
  'Pago mensualidad enero',
  'NEQ-001'
),
-- Bancolombia
(
  (SELECT perfiles.id FROM perfiles WHERE nombre_completo = 'Sara Juliana Ramírez' LIMIT 1),
  (SELECT matriculas.id FROM matriculas LIMIT 1),
  320000,
  'Bancolombia',
  CURRENT_DATE,
  'Pago mensualidad enero',
  'BCO-001'
),
-- Sistecredito
(
  (SELECT perfiles.id FROM perfiles WHERE nombre_completo = 'María Fernanda Castro' LIMIT 1),
  (SELECT matriculas.id FROM matriculas LIMIT 1),
  350000,
  'Sistecredito',
  CURRENT_DATE,
  'Pago mensualidad enero',
  'SIS-001'
);

-- =====================================================
-- PASO 6: CREAR EJEMPLOS DE PAGOS NÓMINA (PROFESOR)
-- =====================================================

INSERT INTO pagos_nomina (profesor_id, fecha_pago, total_pagado, total_horas, fecha_inicio_periodo, fecha_fin_periodo, observaciones)
VALUES
(
  (SELECT perfiles.id FROM perfiles WHERE nombre_completo = 'Martha Cristina Rodríguez' LIMIT 1),
  CURRENT_DATE,
  800000,
  16,
  DATE_TRUNC('month', CURRENT_DATE),
  DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day',
  'Pago primera quincena enero - Método: Efectivo'
),
(
  (SELECT perfiles.id FROM perfiles WHERE nombre_completo = 'Diana Carolina López' LIMIT 1),
  CURRENT_DATE,
  900000,
  15,
  DATE_TRUNC('month', CURRENT_DATE),
  DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day',
  'Pago primera quincena enero - Método: Nequi'
);

-- =====================================================
-- RESUMEN DE DATOS CREADOS
-- =====================================================

-- Ver cursos creados
SELECT 'CURSOS CREADOS:' as info;
SELECT id, nombre, duracion, duracion_horas, precio_mensualidad, total_clases FROM cursos ORDER BY nombre;

-- Ver profesores creados
SELECT 'PROFESORES CREADOS:' as info;
SELECT id, nombre_completo, email, telefono FROM perfiles WHERE rol = 'profesor' ORDER BY nombre_completo;

-- Ver estudiantes creados
SELECT 'ESTUDIANTES CREADOS:' as info;
SELECT id, nombre_completo, email, telefono, identificacion FROM perfiles WHERE rol = 'estudiante' ORDER BY nombre_completo;

-- Resumen final
SELECT 
  (SELECT COUNT(*) FROM cursos) as total_cursos,
  (SELECT COUNT(*) FROM perfiles WHERE rol = 'profesor') as total_profesores,
  (SELECT COUNT(*) FROM perfiles WHERE rol = 'estudiante') as total_estudiantes,
  (SELECT COUNT(*) FROM matriculas) as total_matriculas,
  (SELECT COUNT(*) FROM asistencias) as total_asistencias,
  (SELECT COUNT(*) FROM pagos) as total_pagos;
