-- Agregar índice único para habilitar upsert por (matricula_id, tema_id)
-- Ejecutar en Supabase SQL Editor

CREATE UNIQUE INDEX IF NOT EXISTS calificaciones_matricula_tema_unique
ON calificaciones (matricula_id, tema_id);
