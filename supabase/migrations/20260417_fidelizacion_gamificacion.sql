-- =====================================================
-- GAMIFICACIÓN - La Cosmetikera
-- Ejecutar en: https://supabase.com/dashboard/project/gzrogwpbkkynhuostxle/sql/new
-- =====================================================

-- 1. Nuevas columnas en perfiles para gamificación
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS cedula              text UNIQUE,
  ADD COLUMN IF NOT EXISTS logros              jsonb    NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS racha_visitas       integer  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fecha_ultima_visita date,
  ADD COLUMN IF NOT EXISTS puntos_canjeados    integer  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS puntos_ganados      integer  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fecha_nacimiento    date;

-- 2. Tabla de historial de puntos (auditoría completa)
CREATE TABLE IF NOT EXISTS public.puntos_historial (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id    uuid        NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  tipo         text        NOT NULL CHECK (tipo IN ('ganados','canjeados','bonificacion','ajuste','bienvenida','cumpleanos','racha')),
  puntos       integer     NOT NULL,
  concepto     text        NOT NULL,
  referencia   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid
);

ALTER TABLE public.puntos_historial ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total puntos_historial" ON public.puntos_historial;
CREATE POLICY "Acceso total puntos_historial"
  ON public.puntos_historial FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Tabla de misiones activas
CREATE TABLE IF NOT EXISTS public.misiones (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo       text        NOT NULL,
  descripcion  text        NOT NULL,
  tipo         text        NOT NULL DEFAULT 'compras',  -- compras | monto | visitas | referido
  meta         integer     NOT NULL DEFAULT 1,
  puntos_premio integer    NOT NULL DEFAULT 100,
  emoji        text        NOT NULL DEFAULT '🎯',
  activa       boolean     NOT NULL DEFAULT true,
  fecha_inicio date,
  fecha_fin    date,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.misiones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total misiones" ON public.misiones;
CREATE POLICY "Acceso total misiones"
  ON public.misiones FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Misiones de ejemplo
INSERT INTO public.misiones (titulo, descripcion, tipo, meta, puntos_premio, emoji, activa) VALUES
  ('Primera compra',         'Realiza tu primera compra en La Cosmetikera',         'compras', 1,   50,  '🌟', true),
  ('Compradora frecuente',   'Realiza 5 compras en total',                           'compras', 5,   200, '🛍️', true),
  ('Gran compradora',        'Realiza 10 compras en total',                          'compras', 10,  500, '👑', true),
  ('Gasto $200.000',         'Acumula $200.000 en compras',                          'monto',   200000, 300, '💰', true),
  ('Gasto $500.000',         'Acumula $500.000 en compras',                          'monto',   500000, 800, '💎', true),
  ('3 meses seguidos',       'Compra durante 3 meses consecutivos',                  'racha',   3,   400, '🔥', true),
  ('Trae una amiga',         'Refiere a una nueva cliente',                          'referido', 1,  300, '🤝', true)
ON CONFLICT DO NOTHING;

-- 4. Tabla de canjeos de puntos
CREATE TABLE IF NOT EXISTS public.canjes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id    uuid        NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  puntos       integer     NOT NULL,
  valor_cop    numeric(12,2),
  descripcion  text,
  estado       text        NOT NULL DEFAULT 'aplicado',
  venta_id     uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid
);

ALTER TABLE public.canjes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total canjes" ON public.canjes;
CREATE POLICY "Acceso total canjes"
  ON public.canjes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Configuración del programa de puntos
CREATE TABLE IF NOT EXISTS public.config_fidelizacion (
  id                      serial  PRIMARY KEY,
  pesos_por_punto         integer NOT NULL DEFAULT 1000,   -- $1000 = 1 punto
  puntos_bienvenida       integer NOT NULL DEFAULT 50,
  puntos_cumpleanos       integer NOT NULL DEFAULT 100,
  multiplicador_cumple    numeric(3,1) NOT NULL DEFAULT 2.0, -- x2 en mes de cumple
  puntos_por_canje        integer NOT NULL DEFAULT 100,    -- 100 pts = $5000
  valor_canje_cop         integer NOT NULL DEFAULT 5000,
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.config_fidelizacion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura publica config_fidelizacion" ON public.config_fidelizacion;
CREATE POLICY "Lectura publica config_fidelizacion"
  ON public.config_fidelizacion FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Acceso total config_fidelizacion" ON public.config_fidelizacion;
CREATE POLICY "Acceso total config_fidelizacion"
  ON public.config_fidelizacion FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.config_fidelizacion DEFAULT VALUES ON CONFLICT DO NOTHING;
