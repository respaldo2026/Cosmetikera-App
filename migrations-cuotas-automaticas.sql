-- ================================================
-- MIGRACIÓN: Sistema de Cuotas Automáticas
-- ================================================
-- Mejora el sistema de pagos para generar cuotas automáticas
-- al momento de matricular un estudiante
-- ================================================

-- 1. Agregar campos a la tabla pagos
ALTER TABLE pagos
ADD COLUMN IF NOT EXISTS periodo_pagado TEXT, -- "Mes 1", "Mes 2", "Inscripción", etc.
ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE, -- Fecha máxima de pago
ADD COLUMN IF NOT EXISTS numero_cuota INTEGER, -- 0 (inscripción), 1, 2, 3, 4...
ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado', 'vencido', 'cancelado'));

-- 1.4. Permitir NULL en fecha_pago (se llena cuando efectivamente se paga)
ALTER TABLE pagos ALTER COLUMN fecha_pago DROP NOT NULL;

-- 1.5. Agregar campo precio_inscripcion a la tabla programas
ALTER TABLE programas
ADD COLUMN IF NOT EXISTS precio_inscripcion NUMERIC(10,2) DEFAULT 50000;

COMMENT ON COLUMN programas.precio_inscripcion IS 'Valor de inscripción que se cobra al matricular (pagado automáticamente)';

-- 2. Actualizar registros existentes sin estado
UPDATE pagos
SET estado = 'pagado'
WHERE estado IS NULL AND fecha_pago IS NOT NULL;

UPDATE pagos
SET estado = 'pendiente'
WHERE estado IS NULL AND fecha_pago IS NULL;

-- 3. Crear índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos(estado);
CREATE INDEX IF NOT EXISTS idx_pagos_vencimiento ON pagos(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_pagos_matricula_estado ON pagos(matricula_id, estado);

-- 4. Función para generar cuotas automáticas al matricular
CREATE OR REPLACE FUNCTION generar_cuotas_automaticas()
RETURNS TRIGGER AS $$
DECLARE
    duracion_meses INTEGER;
    precio_programa NUMERIC(10,2);
    precio_inscripcion NUMERIC(10,2);
    precio_cuota NUMERIC(10,2);
    fecha_base DATE;
    i INTEGER;
    fecha_vencimiento_cuota DATE;
BEGIN
    -- Obtener duración del programa (en meses), precio y valor de inscripción
    SELECT 
        COALESCE(CAST(NULLIF(REGEXP_REPLACE(p.duracion, '[^0-9]', '', 'g'), '') AS INTEGER), 1),
        COALESCE(p.precio, 0),
        COALESCE(p.precio_inscripcion, 50000) -- Valor por defecto de inscripción
    INTO duracion_meses, precio_programa, precio_inscripcion
    FROM cursos c
    LEFT JOIN programas p ON c.programa_id = p.id
    WHERE c.id = NEW.curso_id;

    -- Si no hay duración definida, usar 1 mes por defecto
    IF duracion_meses IS NULL OR duracion_meses = 0 THEN
        duracion_meses := 1;
    END IF;

    -- Calcular precio por cuota (SIN incluir inscripción)
    IF precio_programa > 0 AND duracion_meses > 0 THEN
        precio_cuota := precio_programa / duracion_meses;
    ELSE
        precio_cuota := 0; -- Admin deberá definir el monto manualmente
    END IF;

    -- Usar fecha de inicio del curso como base, o fecha actual
    SELECT COALESCE(fecha_inicio, CURRENT_DATE)
    INTO fecha_base
    FROM cursos
    WHERE id = NEW.curso_id;

    -- 1. INSERTAR INSCRIPCIÓN (PENDIENTE - debe pagarse para completar matrícula financiera)
    INSERT INTO pagos (
        estudiante_id,
        matricula_id,
        monto,
        periodo_pagado,
        numero_cuota,
        fecha_vencimiento,
        fecha_pago,
        estado,
        metodo_pago,
        observaciones
    ) VALUES (
        NEW.estudiante_id,
        NEW.id,
        precio_inscripcion,
        'Inscripción',
        0, -- Número 0 para que aparezca primero
        fecha_base, -- Vence el mismo día de inicio
        NULL, -- Se llenará cuando se pague
        'pendiente', -- PENDIENTE: debe pagarse para completar matrícula financiera
        NULL, -- Se definirá al pagar
        'Matrícula académica registrada. Pendiente pago de inscripción para completar matrícula financiera.'
    );

    -- 2. GENERAR CUOTAS MENSUALES (una por cada mes de duración)
    FOR i IN 1..duracion_meses LOOP
        -- Calcular fecha de vencimiento: Mismo día de inicio del curso para evitar errores de cálculo
        fecha_vencimiento_cuota := fecha_base + (INTERVAL '1 month' * (i - 1));

        -- Insertar cuota mensual
        INSERT INTO pagos (
            estudiante_id,
            matricula_id,
            monto,
            periodo_pagado,
            numero_cuota,
            fecha_vencimiento,
            estado,
            metodo_pago,
            observaciones
        ) VALUES (
            NEW.estudiante_id,
            NEW.id,
            precio_cuota,
            'Mes ' || i,
            i,
            fecha_vencimiento_cuota,
            'pendiente',
            NULL, -- Se definirá al pagar
            'Cuota mensual generada automáticamente'
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Crear trigger para ejecutar la función al insertar matrícula
DROP TRIGGER IF EXISTS trigger_generar_cuotas ON matriculas;
CREATE TRIGGER trigger_generar_cuotas
    AFTER INSERT ON matriculas
    FOR EACH ROW
    EXECUTE FUNCTION generar_cuotas_automaticas();

-- 6. Función para actualizar estado de cuotas vencidas (ejecutar periódicamente)
CREATE OR REPLACE FUNCTION actualizar_cuotas_vencidas()
RETURNS void AS $$
BEGIN
    UPDATE pagos
    SET estado = 'vencido'
    WHERE estado = 'pendiente'
      AND fecha_vencimiento < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- 7. Función para marcar cuota como pagada
CREATE OR REPLACE FUNCTION marcar_cuota_pagada(
    p_pago_id UUID,
    p_monto_pagado NUMERIC,
    p_metodo_pago TEXT,
    p_referencia TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    UPDATE pagos
    SET 
        estado = 'pagado',
        fecha_pago = NOW(),
        monto = p_monto_pagado,
        metodo_pago = p_metodo_pago,
        referencia = p_referencia,
        observaciones = COALESCE(observaciones, '') || ' | Pagado el ' || TO_CHAR(NOW(), 'DD/MM/YYYY')
    WHERE id = p_pago_id;
END;
$$ LANGUAGE plpgsql;

-- 8. Vista para consultar estado de cuotas por estudiante
CREATE OR REPLACE VIEW vista_estado_cuotas AS
SELECT 
    p.id AS pago_id,
    p.estudiante_id,
    perf.nombre_completo AS estudiante_nombre,
    p.matricula_id,
    c.nombre AS curso_nombre,
    p.periodo_pagado,
    p.numero_cuota,
    p.monto,
    p.fecha_vencimiento,
    p.fecha_pago,
    p.estado,
    p.metodo_pago,
    CASE 
        WHEN p.estado = 'pagado' THEN 'Pagado'
        WHEN p.estado = 'vencido' THEN 'Vencido'
        WHEN p.fecha_vencimiento < CURRENT_DATE THEN 'Vencido'
        WHEN p.fecha_vencimiento <= CURRENT_DATE + INTERVAL '7 days' THEN 'Por vencer'
        ELSE 'Pendiente'
    END AS estado_visual,
    CASE
        WHEN p.estado = 'pagado' THEN 0
        WHEN p.estado = 'vencido' OR p.fecha_vencimiento < CURRENT_DATE THEN CURRENT_DATE - p.fecha_vencimiento
        ELSE 0
    END AS dias_vencido
FROM pagos p
LEFT JOIN perfiles perf ON p.estudiante_id = perf.id
LEFT JOIN matriculas m ON p.matricula_id = m.id
LEFT JOIN cursos c ON m.curso_id = c.id
ORDER BY p.estudiante_id, p.numero_cuota;

-- 9. RLS Policies para pagos (mantener seguridad)
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

-- Estudiantes ven solo sus pagos
DROP POLICY IF EXISTS "Estudiantes ven sus pagos" ON pagos;
CREATE POLICY "Estudiantes ven sus pagos"
ON pagos FOR SELECT
USING (
    auth.uid() = estudiante_id
);

-- Admin y personal ven todos los pagos
DROP POLICY IF EXISTS "Personal ve todos los pagos" ON pagos;
CREATE POLICY "Personal ve todos los pagos"
ON pagos FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM perfiles
        WHERE perfiles.id = auth.uid()
        AND perfiles.rol IN ('admin', 'director', 'administrativo', 'profesor')
    )
);

-- 10. Comentarios para documentación
COMMENT ON COLUMN pagos.periodo_pagado IS 'Descripción del periodo: "Mes 1", "Mes 2", "Inscripción"';
COMMENT ON COLUMN pagos.numero_cuota IS 'Número secuencial de la cuota dentro de la matrícula';
COMMENT ON COLUMN pagos.fecha_vencimiento IS 'Fecha máxima de pago (basada en fecha inicio curso)';
COMMENT ON COLUMN pagos.estado IS 'Estado del pago: pendiente, pagado, vencido, cancelado';
COMMENT ON FUNCTION generar_cuotas_automaticas() IS 'Genera cuotas automáticamente al crear una matrícula';
COMMENT ON FUNCTION actualizar_cuotas_vencidas() IS 'Actualiza estado de cuotas que ya vencieron';
COMMENT ON FUNCTION marcar_cuota_pagada(UUID, NUMERIC, TEXT, TEXT) IS 'Marca una cuota como pagada con los datos del pago';

-- ================================================
-- INSTRUCCIONES DE USO
-- ================================================
/*
IMPORTANTE: FLUJO DE MATRÍCULA ACADÉMICA Y FINANCIERA

1. MATRÍCULA ACADÉMICA (Registro inicial):
   Al matricular un estudiante en un curso:
   - Se crea el registro en la tabla "matriculas"
   - El trigger genera automáticamente las cuentas de cobro:
     * Cuota 0 (Inscripción): estado='pendiente', monto=precio_inscripcion ⏳
     * Cuotas 1-N (Mensuales): estado='pendiente', monto=precio_programa/duración ⏳
   - El estudiante queda MATRICULADO ACADÉMICAMENTE pero NO FINANCIERAMENTE

2. MATRÍCULA FINANCIERA (Completar inscripción):
   Para completar la matrícula financiera:
   - El estudiante debe pagar la Inscripción (Cuota 0)
   - Subir el comprobante de pago
   - En Tesorería: Registrar pago de la cuota de inscripción
   - Se actualiza: estado='pagado', fecha_pago=NOW(), metodo_pago, referencia
   - AHORA SÍ la matrícula está completa financieramente ✅

3. PAGOS MENSUALES:
   - Las cuotas mensuales (1, 2, 3...) se pagan según vencimiento
   - Mismo proceso: registrar pago en tesorería con comprobante
   
4. VISUALIZACIÓN:
   - Perfil del estudiante: Muestra TODAS las cuotas (pendientes y pagadas)
   - Tesorería: Solo muestra pagos con estado='pagado' (ingresos reales)
   
5. ESTADOS DE MATRÍCULA:
   - Académica registrada: Existe registro en "matriculas"
   - Financiera pendiente: Inscripción (cuota 0) con estado='pendiente'
   - Financiera completa: Inscripción (cuota 0) con estado='pagado' ✅

6. Para actualizar cuotas vencidas periódicamente (ejecutar con cron job):
   SELECT actualizar_cuotas_vencidas();

7. Para marcar una cuota como pagada manualmente:
   SELECT marcar_cuota_pagada(
       'uuid-del-pago'::UUID,
       50000, -- monto
       'efectivo', -- metodo
       'REF-12345' -- referencia opcional
   );

8. Para consultar estado de cuotas de un estudiante:
   SELECT * FROM vista_estado_cuotas
   WHERE estudiante_id = 'uuid-del-estudiante';

9. Ejemplo de flujo completo:
   
   PASO 1: Matrícula Académica
   → Se registra estudiante en curso
   → Trigger genera cuotas automáticamente:
   
   ┌─────────────────────────────────────────────┐
   │ Cuota 0: Inscripción                        │
   │ Monto: $50,000                              │
   │ Estado: PENDIENTE ⏳                        │
   │ Aparece en: Solo perfil del estudiante      │
   │ Acción: Estudiante debe pagar + comprobante│
   ├─────────────────────────────────────────────┤
   │ Cuota 1: Mes 1                              │
   │ Monto: $50,000                              │
   │ Estado: PENDIENTE ⏳                        │
   │ Aparece en: Solo perfil del estudiante      │
   ├─────────────────────────────────────────────┤
   │ Cuota 2: Mes 2                              │
   │ Monto: $50,000                              │
   │ Estado: PENDIENTE ⏳                        │
   │ Aparece en: Solo perfil del estudiante      │
   └─────────────────────────────────────────────┘
   
   PASO 2: Matrícula Financiera (Pago de Inscripción)
   → Estudiante paga inscripción y presenta comprobante
   → En tesorería: Registrar pago de cuota 0 (Inscripción)
   → La cuota cambia a estado='pagado', fecha_pago=HOY
   → AHORA SÍ aparece en tesorería como ingreso
   → Matrícula financiera completa ✅
   
   PASO 3: Pagos mensuales
   → Estudiante paga cada cuota mensual con comprobante
   → Se registra cada pago en tesorería
   → Aparecen en tesorería conforme se pagan
   
   TOTAL: $50,000 (inscripción) + $200,000 (programa) = $250,000

10. Verificar que el trigger está activo:
    SELECT * FROM pg_trigger WHERE tgname = 'trigger_generar_cuotas';

11. Ver todas las cuotas de una matrícula:
    SELECT numero_cuota, periodo_pagado, monto, estado, fecha_vencimiento, fecha_pago
    FROM pagos
    WHERE matricula_id = 'uuid-de-matricula'
    ORDER BY numero_cuota;
    
12. Ver estado de matrícula (académica vs financiera):
    SELECT 
        m.id,
        m.estudiante_id,
        m.curso_id,
        m.created_at as fecha_matricula_academica,
        p.estado as estado_inscripcion,
        p.fecha_pago as fecha_matricula_financiera,
        CASE 
            WHEN p.estado = 'pagado' THEN 'Matrícula Completa ✅'
            ELSE 'Pendiente Pago Inscripción ⏳'
        END as estado_matricula
    FROM matriculas m
    LEFT JOIN pagos p ON p.matricula_id = m.id AND p.numero_cuota = 0
    WHERE m.id = 'uuid-de-matricula';
*/
