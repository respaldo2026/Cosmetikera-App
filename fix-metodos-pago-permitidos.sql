-- ================================================
-- FIX: PERMITIR TODOS LOS MÉTODOS DE PAGO
-- ================================================
-- Actualiza el trigger para permitir nequi y sistecredito
-- ================================================

-- Recrear la función con los nuevos métodos permitidos
DROP FUNCTION IF EXISTS check_pagos_values() CASCADE;

CREATE OR REPLACE FUNCTION check_pagos_values() RETURNS TRIGGER AS $$
BEGIN
    -- Validar que el monto sea positivo
    IF NEW.monto <= 0 THEN
        RAISE EXCEPTION 'El monto debe ser positivo';
    END IF;

    IF NEW.monto > 999999999 THEN
        RAISE EXCEPTION 'El monto es demasiado alto';
    END IF;

    -- Solo validar método de pago si no es NULL (permitir NULL para pagos pendientes)
    -- Ahora permite: efectivo, transferencia, tarjeta, nequi, sistecredito, otro
    IF NEW.metodo_pago IS NOT NULL AND LOWER(NEW.metodo_pago) NOT IN ('efectivo', 'transferencia', 'tarjeta', 'nequi', 'sistecredito', 'otro') THEN
        RAISE EXCEPTION 'Método de pago no permitido: %', NEW.metodo_pago;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear el trigger
DROP TRIGGER IF EXISTS check_monto_pago ON pagos;
CREATE TRIGGER check_monto_pago
BEFORE INSERT OR UPDATE ON pagos
FOR EACH ROW
EXECUTE FUNCTION check_pagos_values();

-- =============================================
-- VERIFICACIÓN
-- =============================================

-- Probar que ahora permite nequi
SELECT 'Trigger actualizado correctamente' AS resultado;
