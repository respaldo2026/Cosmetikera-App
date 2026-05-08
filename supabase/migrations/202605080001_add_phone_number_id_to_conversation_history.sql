-- Agrega phone_number_id a whatsapp_conversation_history
-- para distinguir mensajes por bot/proyecto cuando varios comparten el mismo Supabase.

ALTER TABLE whatsapp_conversation_history
  ADD COLUMN IF NOT EXISTS phone_number_id TEXT;

-- Índice para acelerar los filtros por phone_number_id
CREATE INDEX IF NOT EXISTS idx_wch_phone_number_id
  ON whatsapp_conversation_history (phone_number_id);

-- Índice compuesto (teléfono + proyecto) para el detalle de conversación
CREATE INDEX IF NOT EXISTS idx_wch_telefono_phone_number_id
  ON whatsapp_conversation_history (telefono, phone_number_id);
