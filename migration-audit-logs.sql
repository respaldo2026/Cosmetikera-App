-- =====================================================
-- SISTEMA DE LOGS DE AUDITORÍA (AUDIT TRAILS)
-- Registra cambios históricos en tablas sensibles
-- =====================================================

-- 1. CREAR TABLA DE LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL,          -- Nombre de la tabla afectada (pagos, calificaciones, etc.)
    record_id TEXT NOT NULL,           -- ID del registro afectado (convertido a texto)
    operation TEXT NOT NULL,           -- INSERT, UPDATE, DELETE
    old_data JSONB,                    -- Datos antes del cambio (para UPDATE/DELETE)
    new_data JSONB,                    -- Datos después del cambio (para INSERT/UPDATE)
    changed_by UUID REFERENCES auth.users(id), -- Usuario que realizó la acción
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. SEGURIDAD (RLS)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Política: Solo Admins y Directores pueden VER los logs
DROP POLICY IF EXISTS "Admins ven logs" ON audit_logs;
CREATE POLICY "Admins ven logs" ON audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM perfiles
            WHERE id = auth.uid()
            AND rol IN ('admin', 'director')
        )
    );

-- Nota: No se crean políticas de INSERT/UPDATE/DELETE para usuarios porque
-- la inserción la hace el sistema (Trigger con SECURITY DEFINER) y
-- los logs deben ser inmutables (nadie debe poder borrarlos).

-- 3. FUNCIÓN GENÉRICA DE AUDITORÍA
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_record_id TEXT;
    v_user_id UUID;
BEGIN
    -- Obtener ID del usuario actual (si existe sesión)
    v_user_id := auth.uid();
    
    -- Determinar operación y datos
    IF (TG_OP = 'INSERT') THEN
        v_new_data := to_jsonb(NEW);
        v_record_id := NEW.id::TEXT;
    ELSIF (TG_OP = 'UPDATE') THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_record_id := NEW.id::TEXT;
        
        -- Optimización: Si no hubo cambios reales en los datos, no registrar (opcional)
        -- IF v_old_data = v_new_data THEN RETURN NEW; END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        v_old_data := to_jsonb(OLD);
        v_record_id := OLD.id::TEXT;
    END IF;

    -- Insertar registro de auditoría
    INSERT INTO audit_logs (
        table_name,
        record_id,
        operation,
        old_data,
        new_data,
        changed_by
    ) VALUES (
        TG_TABLE_NAME,
        v_record_id,
        TG_OP,
        v_old_data,
        v_new_data,
        v_user_id
    );

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. APLICAR TRIGGERS A TABLAS SENSIBLES

-- Auditoría en PAGOS (Crítico para finanzas)
DROP TRIGGER IF EXISTS audit_pagos_trigger ON pagos;
CREATE TRIGGER audit_pagos_trigger
AFTER INSERT OR UPDATE OR DELETE ON pagos
FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- Auditoría en CALIFICACIONES (Crítico académico)
DROP TRIGGER IF EXISTS audit_calificaciones_trigger ON calificaciones;
CREATE TRIGGER audit_calificaciones_trigger
AFTER INSERT OR UPDATE OR DELETE ON calificaciones
FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- Auditoría en MATRÍCULAS (Crítico administrativo)
DROP TRIGGER IF EXISTS audit_matriculas_trigger ON matriculas;
CREATE TRIGGER audit_matriculas_trigger
AFTER INSERT OR UPDATE OR DELETE ON matriculas
FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- Verificación
SELECT 'Sistema de Auditoría instalado correctamente' as estado;