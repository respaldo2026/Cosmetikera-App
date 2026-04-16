-- Add schedule fields to cursos table
ALTER TABLE cursos 
ADD COLUMN IF NOT EXISTS dias_semana TEXT,
ADD COLUMN IF NOT EXISTS hora_inicio TIME,
ADD COLUMN IF NOT EXISTS hora_fin TIME,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Set default values for existing records
UPDATE cursos SET 
  dias_semana = COALESCE(dias_semana, 'Lunes, Miércoles, Viernes'),
  hora_inicio = COALESCE(hora_inicio, '09:00:00'::TIME),
  hora_fin = COALESCE(hora_fin, '10:30:00'::TIME),
  updated_at = CURRENT_TIMESTAMP
WHERE dias_semana IS NULL OR hora_inicio IS NULL OR hora_fin IS NULL;

-- Create index for better performance on estado queries
CREATE INDEX IF NOT EXISTS idx_cursos_estado ON cursos(estado);
