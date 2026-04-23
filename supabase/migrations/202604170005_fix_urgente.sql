-- =====================================================
-- FIX URGENTE — Ejecutar en Supabase SQL Editor
-- https://supabase.com/dashboard/project/gzrogwpbkkynhuostxle/sql/new
-- =====================================================

-- ─── 1. Columnas de gamificación en perfiles (400 Bad Request) ────────────
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS cedula              text UNIQUE,
  ADD COLUMN IF NOT EXISTS logros              jsonb    NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS racha_visitas       integer  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fecha_ultima_visita date,
  ADD COLUMN IF NOT EXISTS puntos_canjeados    integer  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS puntos_ganados      integer  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fecha_nacimiento    date;

-- ─── 2. RLS perfiles: permitir INSERT y UPDATE (401 Unauthorized) ─────────
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir SELECT perfiles"  ON public.perfiles;
DROP POLICY IF EXISTS "Permitir INSERT perfiles"  ON public.perfiles;
DROP POLICY IF EXISTS "Permitir UPDATE perfiles"  ON public.perfiles;
DROP POLICY IF EXISTS "Permitir DELETE perfiles"  ON public.perfiles;
DROP POLICY IF EXISTS "Acceso total perfiles"     ON public.perfiles;

CREATE POLICY "Acceso total perfiles"
  ON public.perfiles FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ─── 3. Constraint de rol: permitir 'cliente' ─────────────────────────────
ALTER TABLE public.perfiles DROP CONSTRAINT IF EXISTS perfiles_rol_check;

ALTER TABLE public.perfiles
  ADD CONSTRAINT perfiles_rol_check
  CHECK (rol IN ('administrador', 'marketing', 'vendedor', 'cliente'));

-- ─── 4. Tablas de gamificación (si no existen) ────────────────────────────

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
