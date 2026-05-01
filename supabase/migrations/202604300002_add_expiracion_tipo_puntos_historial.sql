-- Permite registrar vencimientos automáticos de puntos en auditoría
ALTER TABLE public.puntos_historial
  DROP CONSTRAINT IF EXISTS puntos_historial_tipo_check;

ALTER TABLE public.puntos_historial
  ADD CONSTRAINT puntos_historial_tipo_check
  CHECK (
    tipo IN (
      'ganados',
      'canjeados',
      'bonificacion',
      'ajuste',
      'bienvenida',
      'cumpleanos',
      'racha',
      'referido',
      'expiracion'
    )
  );
