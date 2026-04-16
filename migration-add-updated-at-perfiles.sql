-- Agrega columna updated_at a perfiles y repara trigger de timestamp

-- 1) Crear columna si no existe
ALTER TABLE perfiles
ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- 2) Crear función genérica si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'trigger_set_timestamp'
  ) THEN
    CREATE OR REPLACE FUNCTION trigger_set_timestamp()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 3) Quitar trigger previo y recrearlo apuntando a updated_at
DROP TRIGGER IF EXISTS update_perfiles_updated_at ON perfiles;
CREATE TRIGGER update_perfiles_updated_at
BEFORE UPDATE ON perfiles
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();
