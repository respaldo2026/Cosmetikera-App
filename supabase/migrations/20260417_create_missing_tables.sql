-- =====================================================
-- TABLAS FALTANTES - La Cosmetikera
-- Ejecutar en: https://supabase.com/dashboard/project/gzrogwpbkkynhuostxle/sql/new
-- =====================================================

-- =====================================================
-- 1. ROLE_PERMISSIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.role_permissions (
  rol         varchar(50) PRIMARY KEY,
  permisos    jsonb        NOT NULL DEFAULT '{}',
  created_at  timestamp    NOT NULL DEFAULT now(),
  updated_at  timestamp    NOT NULL DEFAULT now()
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total role_permissions autenticados" ON public.role_permissions;
CREATE POLICY "Acceso total role_permissions autenticados"
  ON public.role_permissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.role_permissions (rol, permisos) VALUES
  ('admin',       '{"articulos":true,"ventas":true,"compras":true,"proveedores":true,"configuracion":true,"fidelizacion":true,"marketing-center":true,"leads":true,"tesoreria":true,"perfiles":true}'::jsonb),
  ('director',    '{"articulos":true,"ventas":true,"compras":true,"proveedores":true,"configuracion":true,"fidelizacion":true,"marketing-center":true,"leads":true,"tesoreria":true,"perfiles":true}'::jsonb),
  ('secretaria',  '{"articulos":true,"ventas":true,"compras":true,"proveedores":true,"fidelizacion":true,"leads":true}'::jsonb),
  ('estudiante',  '{}'::jsonb),
  ('profesor',    '{}'::jsonb)
ON CONFLICT (rol) DO NOTHING;

-- =====================================================
-- 2. MEDIOS_PAGO
-- =====================================================
CREATE TABLE IF NOT EXISTS public.medios_pago (
  id          serial       PRIMARY KEY,
  nombre      text         NOT NULL,
  codigo      text         NOT NULL,
  descripcion text,
  icono       text,
  activo      boolean      NOT NULL DEFAULT true,
  orden       integer      NOT NULL DEFAULT 0,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.medios_pago ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total medios_pago autenticados" ON public.medios_pago;
CREATE POLICY "Acceso total medios_pago autenticados"
  ON public.medios_pago FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Lectura publica medios_pago" ON public.medios_pago;
CREATE POLICY "Lectura publica medios_pago"
  ON public.medios_pago FOR SELECT TO anon USING (true);

INSERT INTO public.medios_pago (nombre, codigo, activo, orden) VALUES
  ('Efectivo',        'efectivo',      true, 1),
  ('Tarjeta débito',  'tarjeta',       true, 2),
  ('Transferencia',   'transferencia', true, 3),
  ('Nequi',           'nequi',         true, 4),
  ('Daviplata',       'daviplata',     true, 5)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 3. PLANTILLAS_WHATSAPP
-- =====================================================
CREATE TABLE IF NOT EXISTS public.plantillas_whatsapp (
  id          serial       PRIMARY KEY,
  nombre      text         NOT NULL,
  descripcion text,
  plantilla   text         NOT NULL,
  variables   text[]       DEFAULT '{}',
  activa      boolean      NOT NULL DEFAULT true,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.plantillas_whatsapp ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total plantillas_whatsapp autenticados" ON public.plantillas_whatsapp;
CREATE POLICY "Acceso total plantillas_whatsapp autenticados"
  ON public.plantillas_whatsapp FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- 4. MOVIMIENTOS_FINANCIEROS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.movimientos_financieros (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha           date         NOT NULL,
  tipo            text         NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  monto           numeric(14,2) NOT NULL,
  concepto        text         NOT NULL,
  categoria       text,
  metodo_pago     text,
  referencia      text,
  descripcion     text,
  estudiante_id   uuid         REFERENCES public.perfiles(id) ON DELETE SET NULL,
  proveedor_id    uuid         REFERENCES public.perfiles(id) ON DELETE SET NULL,
  ticket_url      text,
  pago_id         uuid         UNIQUE,
  conciliado      boolean      NOT NULL DEFAULT false,
  conciliado_el   timestamptz,
  conciliado_por  uuid,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  created_by      uuid
);

ALTER TABLE public.movimientos_financieros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total movimientos autenticados" ON public.movimientos_financieros;
CREATE POLICY "Acceso total movimientos autenticados"
  ON public.movimientos_financieros FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- 5. LEADS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.leads (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text         NOT NULL,
  telefono    text,
  email       text,
  interes     text,
  canal       text,
  estado      text         NOT NULL DEFAULT 'nuevo',
  notas       text,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total leads autenticados" ON public.leads;
CREATE POLICY "Acceso total leads autenticados"
  ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- 6. MARKETING_ASSETS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.marketing_assets (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo          text         NOT NULL,
  descripcion     text,
  tipo_asset      text         NOT NULL DEFAULT 'flyer',
  url_archivo     text         NOT NULL,
  nombre_archivo  text         NOT NULL,
  tamano_bytes    integer,
  mime_type       text,
  descripcion_ia  text         NOT NULL DEFAULT '',
  keywords        text[]       DEFAULT '{}',
  programa_id     integer,
  curso_id        integer,
  estado          text         NOT NULL DEFAULT 'activo',
  visible_para_ia boolean      NOT NULL DEFAULT true,
  categoria       text,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total marketing_assets autenticados" ON public.marketing_assets;
CREATE POLICY "Acceso total marketing_assets autenticados"
  ON public.marketing_assets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- 7. TAMBIÉN: FIX RLS en tablas ya existentes
--    (resuelve "new row violates row-level security")
-- =====================================================
ALTER TABLE public.articulos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total articulos autenticados" ON public.articulos;
CREATE POLICY "Acceso total articulos autenticados"
  ON public.articulos FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total ventas autenticados" ON public.ventas;
CREATE POLICY "Acceso total ventas autenticados"
  ON public.ventas FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total compras autenticados" ON public.compras;
CREATE POLICY "Acceso total compras autenticados"
  ON public.compras FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total proveedores autenticados" ON public.proveedores;
CREATE POLICY "Acceso total proveedores autenticados"
  ON public.proveedores FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total perfiles autenticados" ON public.perfiles;
CREATE POLICY "Acceso total perfiles autenticados"
  ON public.perfiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- 8. COLUMNA descuento_porcentaje en articulos
-- =====================================================
ALTER TABLE public.articulos
  ADD COLUMN IF NOT EXISTS descuento_porcentaje numeric(5,2) DEFAULT NULL;

-- =====================================================
-- 9. TABLA CONFIGURACION (si no existe aún)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.configuracion (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_academia     text         NOT NULL DEFAULT 'La Cosmetikera',
  logo_url            text,
  slogan              text,
  nit                 text,
  ruc                 text,
  telefono            text,
  email               text,
  direccion           text,
  ciudad              text         NOT NULL DEFAULT 'Colombia',
  pais                text         NOT NULL DEFAULT 'Colombia',
  sitio_web           text,
  instagram           text,
  facebook            text,
  youtube             text,
  maps_url            text,
  mensaje_factura     text,
  ticket_titulo       text,
  ticket_pie          text,
  ticket_nota         text,
  ticket_campos       jsonb        DEFAULT '{}',
  whatsapp_token      text,
  whatsapp_phone_id   text,
  whatsapp_activo     boolean      DEFAULT false,
  moneda              text         DEFAULT 'COP',
  simbolo_moneda      text         DEFAULT '$',
  created_at          timestamptz  NOT NULL DEFAULT now(),
  updated_at          timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total configuracion autenticados" ON public.configuracion;
CREATE POLICY "Acceso total configuracion autenticados"
  ON public.configuracion FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Lectura publica configuracion" ON public.configuracion;
CREATE POLICY "Lectura publica configuracion"
  ON public.configuracion FOR SELECT TO anon USING (true);

INSERT INTO public.configuracion (nombre_academia, ciudad, moneda, simbolo_moneda, ticket_campos)
VALUES (
  'La Cosmetikera', 'Colombia', 'COP', '$',
  '{"logo":true,"nombreAcademia":true,"ruc":true,"direccion":true,"telefono":true,"email":true,"fecha":true,"concepto":true,"monto":true,"nota":true,"pie":true,"titulo":true}'
)
ON CONFLICT DO NOTHING;
