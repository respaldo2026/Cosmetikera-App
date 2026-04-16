-- Migración para agregar el Pensum de "Artista en uñas"

DO $$
DECLARE
    v_programa_id INTEGER;
    v_pensum_id UUID;
BEGIN
    -- 1. Obtener o crear el programa
    SELECT id INTO v_programa_id FROM programas WHERE nombre = 'Artista Integral en Uñas' LIMIT 1;

    IF v_programa_id IS NULL THEN
        INSERT INTO programas (nombre, descripcion, duracion, precio_mensualidad, precio_inscripcion, activo)
        VALUES ('Artista Integral en Uñas', 'Programa completo de formación en arte y cuidado de uñas.', '5 meses', 0, 0, true)
        RETURNING id INTO v_programa_id;
        RAISE NOTICE 'Programa "Artista Integral en Uñas" creado con ID %', v_programa_id;
    ELSE
        RAISE NOTICE 'Programa "Artista Integral en Uñas" ya existe con ID %', v_programa_id;
    END IF;

    -- CICLO 1
    IF NOT EXISTS (SELECT 1 FROM pensum WHERE programa_id = v_programa_id AND numero_ciclo = 1) THEN
        INSERT INTO pensum (programa_id, numero_ciclo, nombre_ciclo, descripcion, duracion_semanas, orden, activo)
        VALUES (v_programa_id, 1, 'Fundamentos, Manicuría y Pedi-Spa', 'Preparación integral y cuidado de manos y pies.', 4, 1, true)
        RETURNING id INTO v_pensum_id;

        INSERT INTO pensum_cursos (pensum_id, nombre_curso, descripcion, horas, tipo_curso, orden) VALUES
        (v_pensum_id, 'Bioseguridad y Anatomía', 'Esterilización, enfermedades y estructura de la uña.', 4, 'obligatorio', 1),
        (v_pensum_id, 'Manicuría Tradicional', 'Preparación de la placa, corte de cutícula y esmaltado.', 4, 'obligatorio', 2),
        (v_pensum_id, 'Pedi-Spa y Salud del Pie', 'Protocolo de limpieza, exfoliación, hidratación, manejo de durezas (sin corte médico) y masaje relajante.', 4, 'obligatorio', 3),
        (v_pensum_id, 'Maquillaje de Uñas (Manos y Pies)', 'Técnicas de aplicación de color y francesa perfecta.', 4, 'obligatorio', 4);
    END IF;

    -- CICLO 2
    IF NOT EXISTS (SELECT 1 FROM pensum WHERE programa_id = v_programa_id AND numero_ciclo = 2) THEN
        INSERT INTO pensum (programa_id, numero_ciclo, nombre_ciclo, descripcion, duracion_semanas, orden, activo)
        VALUES (v_programa_id, 2, 'Sistemas Semipermanentes y Soft Gel', 'Técnicas modernas de esmaltado y extensión.', 4, 2, true)
        RETURNING id INTO v_pensum_id;

        INSERT INTO pensum_cursos (pensum_id, nombre_curso, descripcion, horas, tipo_curso, orden) VALUES
        (v_pensum_id, 'Esmaltado Semipermanente', 'Preparación química y aplicación de larga duración.', 4, 'obligatorio', 1),
        (v_pensum_id, 'Press-on (Soft Gel)', 'Aplicación de tips de cobertura total y adhesión.', 4, 'obligatorio', 2),
        (v_pensum_id, 'Efectos 1', 'Polvos espejo, aurora, glitter y efectos de tendencia.', 4, 'obligatorio', 3),
        (v_pensum_id, 'Efectos 2', 'Spider gel, foil, stamping y degradados.', 4, 'obligatorio', 4);
    END IF;

    -- CICLO 3
    IF NOT EXISTS (SELECT 1 FROM pensum WHERE programa_id = v_programa_id AND numero_ciclo = 3) THEN
        INSERT INTO pensum (programa_id, numero_ciclo, nombre_ciclo, descripcion, duracion_semanas, orden, activo)
        VALUES (v_programa_id, 3, 'Arte y Estructuras en Gel/Polygel', 'Construcción y diseño avanzado.', 4, 3, true)
        RETURNING id INTO v_pensum_id;

        INSERT INTO pensum_cursos (pensum_id, nombre_curso, descripcion, horas, tipo_curso, orden) VALUES
        (v_pensum_id, 'Nail Art Dibujo', 'Trazos finos y mano alzada básica.', 4, 'obligatorio', 1),
        (v_pensum_id, 'Uñas en Gel', 'Extensiones con moldes y geles constructores.', 4, 'obligatorio', 2),
        (v_pensum_id, 'Polygel', 'Técnica híbrida para extensiones resistentes.', 4, 'obligatorio', 3),
        (v_pensum_id, 'Mantenimiento y Retiro', 'Técnicas seguras para retirar sistemas y hacer rellenos.', 4, 'obligatorio', 4);
    END IF;

    -- CICLO 4
    IF NOT EXISTS (SELECT 1 FROM pensum WHERE programa_id = v_programa_id AND numero_ciclo = 4) THEN
        INSERT INTO pensum (programa_id, numero_ciclo, nombre_ciclo, descripcion, duracion_semanas, orden, activo)
        VALUES (v_programa_id, 4, 'Máster en Acrílico (Nivel 1)', 'Fundamentos y técnicas de acrílico.', 4, 4, true)
        RETURNING id INTO v_pensum_id;

        INSERT INTO pensum_cursos (pensum_id, nombre_curso, descripcion, horas, tipo_curso, orden) VALUES
        (v_pensum_id, 'Acrílico 1', 'Química del producto y control de perlas (monómero/polímero).', 4, 'obligatorio', 1),
        (v_pensum_id, 'Acrílico 2', 'Estructura sobre tips y limado técnico.', 4, 'obligatorio', 2),
        (v_pensum_id, 'Acrílico 3', 'Estructura escultural (uso de moldes).', 4, 'obligatorio', 3),
        (v_pensum_id, 'Acrílico 4', 'Encapsulados y decoraciones internas.', 4, 'obligatorio', 4);
    END IF;

    -- CICLO 5
    IF NOT EXISTS (SELECT 1 FROM pensum WHERE programa_id = v_programa_id AND numero_ciclo = 5) THEN
        INSERT INTO pensum (programa_id, numero_ciclo, nombre_ciclo, descripcion, duracion_semanas, orden, activo)
        VALUES (v_programa_id, 5, 'Acrílico Avanzado y Finalización', 'Técnicas avanzadas y preparación profesional.', 4, 5, true)
        RETURNING id INTO v_pensum_id;

        INSERT INTO pensum_cursos (pensum_id, nombre_curso, descripcion, horas, tipo_curso, orden) VALUES
        (v_pensum_id, 'Acrílico 5', 'Baby Boomer, reversa y sellado de cutícula.', 4, 'obligatorio', 1),
        (v_pensum_id, 'Acrílico 6', 'Introducción al 3D (flores y relieves).', 4, 'obligatorio', 2),
        (v_pensum_id, 'Perfeccionamiento de Estructura', 'Corrección de formas (Square, Almond, Coffin).', 4, 'obligatorio', 3),
        (v_pensum_id, 'Proyecto Final y Emprendimiento', 'Examen práctico y gestión del negocio.', 4, 'obligatorio', 4);
    END IF;

END $$;