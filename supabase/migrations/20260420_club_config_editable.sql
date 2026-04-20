-- =====================================================
-- CATÁLOGO DE RECOMPENSAS Y REGLAS EDITABLES - Club La Cosmetikera
-- Ejecutar en: https://supabase.com/dashboard/project/<project>/sql/new
-- =====================================================

-- 1. Catálogo de recompensas (editable desde el admin)
CREATE TABLE IF NOT EXISTS public.club_recompensas_config (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text        NOT NULL UNIQUE,
  icon        text        NOT NULL DEFAULT '🎁',
  title       text        NOT NULL,
  description text        NOT NULL DEFAULT '',
  category    text        NOT NULL DEFAULT 'descuento'
              CHECK (category IN ('descuento','producto','experiencia','cumpleanos')),
  points_cost integer     NOT NULL DEFAULT 100 CHECK (points_cost > 0),
  value_cop   integer     NOT NULL DEFAULT 0 CHECK (value_cop >= 0),
  level_min   text        CHECK (level_min IN ('bronce','plata','oro','diamante')),
  birthday_only boolean   NOT NULL DEFAULT false,
  featured    boolean     NOT NULL DEFAULT false,
  badge       text,
  activa      boolean     NOT NULL DEFAULT true,
  orden       integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.club_recompensas_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total club_recompensas_config" ON public.club_recompensas_config;
CREATE POLICY "Acceso total club_recompensas_config"
  ON public.club_recompensas_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Lectura pública (para el portal /club que no requiere auth admin)
DROP POLICY IF EXISTS "Lectura publica club_recompensas_config" ON public.club_recompensas_config;
CREATE POLICY "Lectura publica club_recompensas_config"
  ON public.club_recompensas_config FOR SELECT TO anon USING (activa = true);

-- 2. Reglas del club (puntos, multiplicadores, umbrales de nivel)
CREATE TABLE IF NOT EXISTS public.club_reglas_config (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clave       text        NOT NULL UNIQUE,
  valor       jsonb       NOT NULL,
  descripcion text        NOT NULL DEFAULT '',
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.club_reglas_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total club_reglas_config" ON public.club_reglas_config;
CREATE POLICY "Acceso total club_reglas_config"
  ON public.club_reglas_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lectura publica club_reglas_config" ON public.club_reglas_config;
CREATE POLICY "Lectura publica club_reglas_config"
  ON public.club_reglas_config FOR SELECT TO anon USING (true);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_club_recompensas_updated ON public.club_recompensas_config;
CREATE TRIGGER trg_club_recompensas_updated
  BEFORE UPDATE ON public.club_recompensas_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_club_reglas_updated ON public.club_reglas_config;
CREATE TRIGGER trg_club_reglas_updated
  BEFORE UPDATE ON public.club_reglas_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- SEED: valores iniciales (catálogo actual)
-- =====================================================
INSERT INTO public.club_recompensas_config
  (key, icon, title, description, category, points_cost, value_cop, level_min, birthday_only, featured, badge, activa, orden)
VALUES
  ('voucher_5k',      '💸', 'Bono inmediato $5.000',   'Úsalo en caja como descuento directo en tu próxima compra.',                       'descuento',    100,  5000,  NULL,       false, true,  'Canje rápido',        true, 1),
  ('mini_kit',        '🧴', 'Mini kit de viaje',        'Kit sorpresa de minis seleccionado en tienda.',                                    'producto',     180,  12000, 'plata',    false, false, 'Favorito',            true, 2),
  ('esmalte_premium', '💅', 'Esmalte premium',          'Canjea un esmalte o producto de impulso participante.',                            'producto',     220,  15000, 'plata',    false, false, NULL,                  true, 3),
  ('voucher_15k',     '🎟️','Voucher $15.000',           'Descuento fuerte para compras medianas o reposición premium.',                     'descuento',    300,  15000, 'oro',      false, true,  'Mejor valor',         true, 4),
  ('experiencia_vip', '✨', 'Experiencia VIP',           'Reserva una atención preferencial o servicio express participante.',               'experiencia',  450,  30000, 'oro',      false, false, NULL,                  true, 5),
  ('birthday_box',    '🎂', 'Birthday beauty box',      'Regalo especial de cumpleaños. Solo disponible en tu mes.',                        'cumpleanos',   350,  25000, 'oro',      true,  false, 'Campaña cumpleaños',  true, 6),
  ('diamante_gift',   '💎', 'Gift bag diamante',        'Bolsa premium con selección exclusiva del club.',                                  'producto',     650,  50000, 'diamante', false, false, 'Exclusivo',           true, 7)
ON CONFLICT (key) DO NOTHING;

-- SEED: reglas del club
INSERT INTO public.club_reglas_config (clave, valor, descripcion) VALUES
  ('puntos_por_mil',              '1',   'Puntos que se acreditan por cada $1.000 COP de compra'),
  ('multiplicador_cumple_bronce', '1',   'Multiplicador de puntos en mes de cumpleaños para nivel Bronce'),
  ('multiplicador_cumple_plata',  '2',   'Multiplicador de puntos en mes de cumpleaños para nivel Plata'),
  ('multiplicador_cumple_oro',    '2',   'Multiplicador de puntos en mes de cumpleaños para nivel Oro'),
  ('multiplicador_cumple_diamante','3',  'Multiplicador de puntos en mes de cumpleaños para nivel Diamante'),
  ('puntos_min_plata',            '1000','Puntos mínimos para alcanzar el nivel Plata'),
  ('puntos_min_oro',              '5000','Puntos mínimos para alcanzar el nivel Oro'),
  ('puntos_min_diamante',         '15000','Puntos mínimos para alcanzar el nivel Diamante'),
  ('descuento_plata',             '5',   'Porcentaje de descuento base para nivel Plata'),
  ('descuento_oro',               '10',  'Porcentaje de descuento base para nivel Oro'),
  ('descuento_diamante',          '15',  'Porcentaje de descuento base para nivel Diamante'),
  ('puntos_bienvenida',           '50',  'Puntos que se acreditan al registrar un cliente nuevo')
ON CONFLICT (clave) DO NOTHING;
