-- Add cohorte field to distinguish between program and cohort instances
ALTER TABLE cursos 
ADD COLUMN IF NOT EXISTS cohorte TEXT;

-- Set default cohort names for existing records based on days/time
UPDATE cursos SET 
  cohorte = CASE 
    WHEN dias_semana LIKE '%Sábado%' OR dias_semana LIKE '%Domingo%' THEN 'Fin de Semana'
    WHEN hora_inicio < '12:00:00'::TIME THEN 'Mañana'
    WHEN hora_inicio >= '12:00:00'::TIME AND hora_inicio < '18:00:00'::TIME THEN 'Tarde'
    ELSE 'Noche'
  END
WHERE cohorte IS NULL;
