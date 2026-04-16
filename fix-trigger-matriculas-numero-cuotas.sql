-- =====================================================
-- FIX DEFINITIVO: error "column c.numero_cuotas does not exist"
-- Ejecutar en Supabase SQL Editor
-- =====================================================

CREATE OR REPLACE FUNCTION public.generar_cuotas_automaticas()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_curso RECORD;
  v_programa RECORD;
  v_precio_inscripcion NUMERIC := 0;
  v_precio_mensualidad NUMERIC := 0;
  v_num_cuotas INTEGER := 4;
  v_fecha_base DATE;
  v_has_periodo_pagado BOOLEAN := FALSE;
  v_i INTEGER;
BEGIN
  -- Curso (evita referenciar columnas inexistentes de forma directa)
  SELECT c.id, c.programa_id, c.fecha_inicio, to_jsonb(c) AS data
  INTO v_curso
  FROM public.cursos c
  WHERE c.id = NEW.curso_id;

  IF v_curso.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Programa
  SELECT p.id, to_jsonb(p) AS data
  INTO v_programa
  FROM public.programas p
  WHERE p.id = v_curso.programa_id;

  -- Valores compatibles con distintos esquemas
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

  v_fecha_base := COALESCE(NEW.fecha_inicio, v_curso.fecha_inicio, CURRENT_DATE);

  -- ¿Existe columna periodo_pagado en pagos?
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pagos'
      AND column_name = 'periodo_pagado'
  ) INTO v_has_periodo_pagado;

  -- 1) Pago de inscripción (cuota 0)
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
        NEW.estudiante_id,
        NEW.id,
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
        NEW.estudiante_id,
        NEW.id,
        0,
        v_precio_inscripcion,
        'pendiente',
        NULL,
        v_fecha_base,
        'Pago de inscripción'
      );
    END IF;
  END IF;

  -- 2) Cuotas mensuales
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
          NEW.estudiante_id,
          NEW.id,
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
          NEW.estudiante_id,
          NEW.id,
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_generar_cuotas ON public.matriculas;
CREATE TRIGGER trigger_generar_cuotas
AFTER INSERT ON public.matriculas
FOR EACH ROW
EXECUTE FUNCTION public.generar_cuotas_automaticas();

-- Opcional: columna de respaldo en cursos, por si la quieres manejar desde UI
ALTER TABLE public.cursos
ADD COLUMN IF NOT EXISTS numero_cuotas INTEGER DEFAULT 4;
