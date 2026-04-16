-- ================================================
-- MIGRATION: Agregar columna observaciones a matriculas
-- Fecha: 2026-01-12
-- Propósito: Permitir notas/comentarios en las inscripciones académicas
-- ================================================

-- Verificar si la columna ya existe (para evitar errores si se ejecuta dos veces)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'matriculas' AND column_name = 'observaciones'
    ) THEN
        -- Agregar la columna observaciones a matriculas
        ALTER TABLE matriculas ADD COLUMN observaciones TEXT;
        RAISE NOTICE 'Columna observaciones agregada a tabla matriculas';
    ELSE
        RAISE NOTICE 'Columna observaciones ya existe en tabla matriculas';
    END IF;
END $$;

-- ================================================
-- FIN DE LA MIGRATION
-- ================================================
