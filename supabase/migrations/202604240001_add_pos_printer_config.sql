-- =====================================================================
-- Agregar configuración de impresora POS a la tabla configuracion
-- Soporta Epson TM-T20II y otras impresoras térmicas ESC/POS vía QZ Tray
-- =====================================================================

ALTER TABLE public.configuracion
  ADD COLUMN IF NOT EXISTS pos_printer_name    text,
  ADD COLUMN IF NOT EXISTS pos_printer_width   integer DEFAULT 48;

COMMENT ON COLUMN public.configuracion.pos_printer_name  IS 'Nombre exacto de la impresora térmica tal como aparece en el SO (ej: EPSON TM-T20II)';
COMMENT ON COLUMN public.configuracion.pos_printer_width IS 'Ancho en caracteres: 48 para papel 80mm, 32 para papel 58mm';
