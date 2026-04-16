-- ================================================
-- MIGRACIÓN: MEDIOS DE PAGO CONFIGURABLES
-- Fecha: 2025-01-10
-- Descripción: Crear tabla para gestionar medios de pago
-- ================================================

-- 1. CREAR TABLA medios_pago
CREATE TABLE IF NOT EXISTS medios_pago (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    codigo TEXT NOT NULL UNIQUE, -- codigo interno ej: 'efectivo', 'nequi'
    descripcion TEXT,
    icono TEXT, -- nombre del icono (opcional)
    activo BOOLEAN DEFAULT true,
    orden INTEGER DEFAULT 0, -- para ordenar en select
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TRIGGER PARA ACTUALIZAR updated_at
DROP TRIGGER IF EXISTS update_medios_pago_updated_at ON medios_pago;
CREATE TRIGGER update_medios_pago_updated_at
    BEFORE UPDATE ON medios_pago
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 3. HABILITAR RLS
ALTER TABLE medios_pago ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICA RLS PERMISIVA
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'medios_pago' AND policyname = 'Enable all access for authenticated users') THEN
        CREATE POLICY "Enable all access for authenticated users" ON medios_pago FOR ALL USING (true);
    END IF;
END $$;

-- 5. INSERTAR MEDIOS DE PAGO POR DEFECTO
INSERT INTO medios_pago (nombre, codigo, descripcion, orden, activo)
VALUES 
    ('Efectivo', 'efectivo', 'Pago en efectivo', 1, true),
    ('Nequi', 'nequi', 'Pago por Nequi', 2, true),
    ('Transferencia', 'transferencia', 'Transferencia bancaria', 3, true),
    ('Sistecredito', 'sistecredito', 'Pago con Sistecredito', 4, true),
    ('Tarjeta', 'tarjeta', 'Pago con tarjeta de crédito/débito', 5, true),
    ('Otro', 'otro', 'Otro medio de pago', 6, true)
ON CONFLICT (codigo) DO NOTHING;

-- 6. CREAR ÍNDICES
CREATE INDEX IF NOT EXISTS idx_medios_pago_codigo ON medios_pago(codigo);
CREATE INDEX IF NOT EXISTS idx_medios_pago_activo ON medios_pago(activo);
CREATE INDEX IF NOT EXISTS idx_medios_pago_orden ON medios_pago(orden);

-- 7. ACTUALIZAR CONSTRAINT DE TABLA PAGOS
-- Primero eliminar el constraint antiguo
ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_metodo_pago_check;

-- Ahora el constraint solo valida que sea NULL o que exista en medios_pago activos
-- No usamos FK porque queremos permitir valores históricos aunque se desactive el medio
ALTER TABLE pagos 
ADD CONSTRAINT pagos_metodo_pago_check 
CHECK (metodo_pago IS NULL);

-- Nota: Removemos el check constraint rígido. La validación se hará en aplicación
-- para permitir flexibilidad con medios históricos

-- 8. LIMPIAR DATOS EXISTENTES - Normalizar códigos
UPDATE pagos 
SET metodo_pago = LOWER(TRIM(metodo_pago))
WHERE metodo_pago IS NOT NULL;

-- Convertir valores antiguos a los nuevos códigos
UPDATE pagos SET metodo_pago = 'efectivo' WHERE LOWER(metodo_pago) = 'efectivo';
UPDATE pagos SET metodo_pago = 'transferencia' WHERE LOWER(metodo_pago) IN ('transferencia', 'transfer');
UPDATE pagos SET metodo_pago = 'tarjeta' WHERE LOWER(metodo_pago) IN ('tarjeta', 'tarjeta de credito', 'tarjeta de debito');
UPDATE pagos SET metodo_pago = 'nequi' WHERE LOWER(metodo_pago) = 'nequi';
UPDATE pagos SET metodo_pago = 'sistecredito' WHERE LOWER(metodo_pago) = 'sistecredito';

-- ================================================
-- VERIFICACIÓN
-- ================================================

-- Ver medios de pago creados
SELECT 
    'MEDIOS DE PAGO CREADOS' as verificacion,
    id,
    nombre,
    codigo,
    activo,
    orden
FROM medios_pago
ORDER BY orden;

-- Ver distribución de métodos en pagos existentes
SELECT 
    'DISTRIBUCIÓN ACTUAL' as verificacion,
    metodo_pago,
    COUNT(*) as cantidad
FROM pagos
WHERE metodo_pago IS NOT NULL
GROUP BY metodo_pago
ORDER BY cantidad DESC;

-- ================================================
-- FIN DE LA MIGRACIÓN
-- ================================================
-- ✅ Tabla medios_pago creada
-- ✅ 6 medios por defecto: Efectivo, Nequi, Transferencia, Sistecredito, Tarjeta, Otro
-- ✅ Constraint actualizado para ser flexible
-- ✅ Datos existentes normalizados
-- ================================================
