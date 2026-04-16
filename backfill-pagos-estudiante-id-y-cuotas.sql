-- =====================================================
-- BACKFILL HISTÓRICO: pagos.estudiante_id + cuotas faltantes
-- Ejecutar en Supabase SQL Editor
-- Fecha: 2026-02-15
-- =====================================================

BEGIN;

-- 1) Completar estudiante_id en pagos históricos (si viene nulo)
UPDATE public.pagos p
SET estudiante_id = m.estudiante_id
FROM public.matriculas m
WHERE p.matricula_id = m.id
  AND p.estudiante_id IS NULL
  AND m.estudiante_id IS NOT NULL;

-- 2) Regenerar cuotas SOLO para matrículas que no tienen ningún pago
DO $$
DECLARE
  v_mat RECORD;
  v_curso RECORD;
  v_programa RECORD;
  v_precio_inscripcion NUMERIC := 0;
  v_precio_mensualidad NUMERIC := 0;
  v_num_cuotas INTEGER := 4;
  v_fecha_base DATE;
  v_has_periodo_pagado BOOLEAN := FALSE;
  v_i INTEGER;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pagos'
      AND column_name = 'periodo_pagado'
  ) INTO v_has_periodo_pagado;

  FOR v_mat IN
    SELECT m.*
    FROM public.matriculas m
    LEFT JOIN public.pagos p ON p.matricula_id = m.id
    GROUP BY m.id
    HAVING COUNT(p.id) = 0
  LOOP
    SELECT c.id, c.programa_id, c.fecha_inicio, to_jsonb(c) AS data
    INTO v_curso
    FROM public.cursos c
    WHERE c.id = v_mat.curso_id;

    IF v_curso.id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT p.id, to_jsonb(p) AS data
    INTO v_programa
    FROM public.programas p
    WHERE p.id = v_curso.programa_id;

    v_precio_inscripcion := COALESCE(
      NULLIF(v_programa.data->>'precio_inscripcion', '')::NUMERIC,
      0
    );

    v_precio_mensualidad := COALESCE(
      NULLIF(v_curso.data->>'precio_mensualidad', '')::NUMERIC,
      NULLIF(v_programa.data->>'precio_mensualidad', '')::NUMERIC,
      NULLIF(v_programa.data->>'precio_curso', '')::NUMERIC,
      0
    );

    v_num_cuotas := COALESCE(
      NULLIF(v_curso.data->>'numero_cuotas', '')::INTEGER,
      NULLIF(v_programa.data->>'numero_cuotas', '')::INTEGER,
      4
    );

    IF v_num_cuotas < 1 THEN
      v_num_cuotas := 1;
    END IF;

    v_fecha_base := COALESCE(v_mat.fecha_inicio, v_curso.fecha_inicio, CURRENT_DATE);

    IF v_precio_inscripcion > 0 THEN
      IF v_has_periodo_pagado THEN
        INSERT INTO public.pagos (
          estudiante_id,
          matricula_id,
          numero_cuota,
          periodo_pagado,
          monto,
          estado,
          metodo_pago,
          fecha_vencimiento,
          observaciones
        ) VALUES (
          v_mat.estudiante_id,
          v_mat.id,
          0,
          'Inscripción',
          v_precio_inscripcion,
          'pendiente',
          NULL,
          v_fecha_base,
          'Pago de inscripción'
        );
      ELSE
        INSERT INTO public.pagos (
          estudiante_id,
          matricula_id,
          numero_cuota,
          monto,
          estado,
          metodo_pago,
          fecha_vencimiento,
          observaciones
        ) VALUES (
          v_mat.estudiante_id,
          v_mat.id,
          0,
          v_precio_inscripcion,
          'pendiente',
          NULL,
          v_fecha_base,
          'Pago de inscripción'
        );
      END IF;
    END IF;

    IF v_precio_mensualidad > 0 THEN
      FOR v_i IN 1..v_num_cuotas LOOP
        IF v_has_periodo_pagado THEN
          INSERT INTO public.pagos (
            estudiante_id,
            matricula_id,
            numero_cuota,
            periodo_pagado,
            monto,
            estado,
            metodo_pago,
            fecha_vencimiento,
            observaciones
          ) VALUES (
            v_mat.estudiante_id,
            v_mat.id,
            v_i,
            'Cuota ' || v_i || ' de ' || v_num_cuotas,
            v_precio_mensualidad,
            'pendiente',
            NULL,
            (v_fecha_base + (v_i || ' month')::INTERVAL)::DATE,
            'Cuota mensual ' || v_i || ' de ' || v_num_cuotas
          );
        ELSE
          INSERT INTO public.pagos (
            estudiante_id,
            matricula_id,
            numero_cuota,
            monto,
            estado,
            metodo_pago,
            fecha_vencimiento,
            observaciones
          ) VALUES (
            v_mat.estudiante_id,
            v_mat.id,
            v_i,
            v_precio_mensualidad,
            'pendiente',
            NULL,
            (v_fecha_base + (v_i || ' month')::INTERVAL)::DATE,
            'Cuota mensual ' || v_i || ' de ' || v_num_cuotas
          );
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

COMMIT;

-- =====================================================
-- VERIFICACIÓN 1: pagos sin estudiante_id (debe dar 0)
-- =====================================================
SELECT COUNT(*) AS pagos_sin_estudiante_id
FROM public.pagos
WHERE estudiante_id IS NULL;

-- =====================================================
-- VERIFICACIÓN 2: matrículas sin pagos (idealmente 0)
-- =====================================================
SELECT m.id AS matricula_id
FROM public.matriculas m
LEFT JOIN public.pagos p ON p.matricula_id = m.id
GROUP BY m.id
HAVING COUNT(p.id) = 0
ORDER BY m.id DESC;

-- =====================================================
-- VERIFICACIÓN 3: resumen reciente
-- =====================================================
SELECT
  p.id,
  p.estudiante_id,
  p.matricula_id,
  p.numero_cuota,
  p.periodo_pagado,
  p.estado,
  p.monto,
  p.fecha_vencimiento,
  p.created_at
FROM public.pagos p
ORDER BY p.created_at DESC
LIMIT 50;
