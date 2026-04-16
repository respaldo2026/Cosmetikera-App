-- ================================================
-- FIX: VERIFICAR Y REPARAR TRIGGERS
-- ================================================

-- Primero, verificar si la función existe y eliminarla si es necesario
DROP FUNCTION IF EXISTS validar_monto_pago() CASCADE;

-- Recrear la función correctamente
CREATE OR REPLACE FUNCTION validar_monto_pago()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.monto IS NULL OR NEW.monto <= 0 THEN
        RAISE EXCEPTION 'El monto debe ser mayor a 0';
    END IF;

    IF NEW.monto > 999999999 THEN
        RAISE EXCEPTION 'El monto es demasiado alto';
    END IF;

    -- Solo validar método de pago si no es NULL (permitir NULL para pagos pendientes)
    -- Permite: efectivo, transferencia, tarjeta, nequi, sistecredito, otro
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
    EXECUTE FUNCTION validar_monto_pago();

-- Verificar que la función update_updated_at_column existe
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear todos los triggers de updated_at
DROP TRIGGER IF EXISTS update_perfiles_updated_at ON perfiles;
CREATE TRIGGER update_perfiles_updated_at
    BEFORE UPDATE ON perfiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cursos_updated_at ON cursos;
CREATE TRIGGER update_cursos_updated_at
    BEFORE UPDATE ON cursos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_matriculas_updated_at ON matriculas;
CREATE TRIGGER update_matriculas_updated_at
    BEFORE UPDATE ON matriculas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_configuracion_updated_at ON configuracion;
CREATE TRIGGER update_configuracion_updated_at
    BEFORE UPDATE ON configuracion
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventario_updated_at ON inventario;
CREATE TRIGGER update_inventario_updated_at
    BEFORE UPDATE ON inventario
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Verificar que todos los triggers están listos
SELECT 
    trigger_name, 
    event_manipulation, 
    event_object_table
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
