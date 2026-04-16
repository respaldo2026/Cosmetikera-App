-- Fix: habilitar upsert por (quiz_id, matricula_id) en quiz_intentos_clase
-- Ejecutar en Supabase SQL Editor

begin;

-- 1) Eliminar duplicados conservando el intento más reciente por (quiz_id, matricula_id)
with ranked as (
  select
    id,
    row_number() over (
      partition by quiz_id, matricula_id
      order by coalesce(updated_at, enviado_at) desc, id desc
    ) as rn
  from public.quiz_intentos_clase
)
delete from public.quiz_intentos_clase q
using ranked r
where q.id = r.id
  and r.rn > 1;

-- 2) Crear restricción UNIQUE si no existe (requerida para ON CONFLICT)
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'quiz_intentos_clase'
      and c.conname = 'quiz_intentos_clase_quiz_id_matricula_id_key'
  ) then
    alter table public.quiz_intentos_clase
      add constraint quiz_intentos_clase_quiz_id_matricula_id_key
      unique (quiz_id, matricula_id);
  end if;
end $$;

-- 3) Índices de apoyo (idempotentes)
create index if not exists idx_quiz_intentos_clase_quiz
  on public.quiz_intentos_clase (quiz_id);

create index if not exists idx_quiz_intentos_clase_matricula
  on public.quiz_intentos_clase (matricula_id);

commit;

-- Verificación rápida
select quiz_id, matricula_id, count(*) as total
from public.quiz_intentos_clase
group by quiz_id, matricula_id
having count(*) > 1;
