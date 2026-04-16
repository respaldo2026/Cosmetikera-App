-- Tabla de auditoría para registrar acciones críticas y cambios importantes
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  details jsonb,
  timestamp timestamptz DEFAULT now()
);

-- Índice para búsquedas rápidas por usuario y fecha
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

-- Ejemplo de trigger para registrar cambios en pagos
-- (adaptar según la tabla y acción específica)
-- CREATE OR REPLACE FUNCTION log_payment_update() RETURNS trigger AS $$
-- BEGIN
--   INSERT INTO audit_logs (user_id, action, entity, entity_id, details)
--   VALUES (current_setting('request.user_id', true)::uuid, 'update', 'pagos', NEW.id, to_jsonb(NEW));
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- CREATE TRIGGER pagos_update_audit
-- AFTER UPDATE ON pagos
-- FOR EACH ROW EXECUTE FUNCTION log_payment_update();
