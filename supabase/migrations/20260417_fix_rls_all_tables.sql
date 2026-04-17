-- =====================================================
-- FIX RLS: Permitir acceso completo a usuarios autenticados
-- en tablas operativas del POS (admin app)
-- =====================================================

-- =====================================================
-- ARTICULOS
-- =====================================================
ALTER TABLE IF EXISTS public.articulos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso total articulos autenticados" ON public.articulos;
CREATE POLICY "Acceso total articulos autenticados"
  ON public.articulos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Lectura publica articulos" ON public.articulos;
CREATE POLICY "Lectura publica articulos"
  ON public.articulos
  FOR SELECT
  TO anon
  USING (true);

-- =====================================================
-- PROVEEDORES
-- =====================================================
ALTER TABLE IF EXISTS public.proveedores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso total proveedores autenticados" ON public.proveedores;
CREATE POLICY "Acceso total proveedores autenticados"
  ON public.proveedores
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- COMPRAS
-- =====================================================
ALTER TABLE IF EXISTS public.compras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso total compras autenticados" ON public.compras;
CREATE POLICY "Acceso total compras autenticados"
  ON public.compras
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- VENTAS
-- =====================================================
ALTER TABLE IF EXISTS public.ventas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso total ventas autenticados" ON public.ventas;
CREATE POLICY "Acceso total ventas autenticados"
  ON public.ventas
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- PERFILES (clientes)
-- =====================================================
ALTER TABLE IF EXISTS public.perfiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso total perfiles autenticados" ON public.perfiles;
CREATE POLICY "Acceso total perfiles autenticados"
  ON public.perfiles
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- Agrega columna descuento_porcentaje si no existe
-- =====================================================
ALTER TABLE IF EXISTS public.articulos
  ADD COLUMN IF NOT EXISTS descuento_porcentaje numeric(5,2) DEFAULT NULL;
