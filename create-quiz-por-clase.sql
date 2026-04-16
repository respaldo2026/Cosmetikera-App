-- Estructura de Quiz por Clase (Material Didáctico)
-- Ejecutar en Supabase SQL Editor

create table if not exists public.quizzes_clase (
  id uuid primary key default gen_random_uuid(),
  programa_id bigint not null references public.programas(id) on delete cascade,
  pensum_id uuid null references public.pensum(id) on delete set null,
  pensum_curso_id uuid not null references public.pensum_cursos(id) on delete cascade,
  titulo text not null,
  descripcion text null,
  total_preguntas integer not null default 25,
  activo boolean not null default true,
  publicado boolean not null default false,
  creado_por uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pensum_curso_id)
);

create table if not exists public.quiz_preguntas_clase (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes_clase(id) on delete cascade,
  orden integer not null,
  pregunta text not null,
  opcion_a text not null,
  opcion_b text not null,
  opcion_c text not null,
  opcion_d text not null,
  respuesta_correcta text not null check (respuesta_correcta in ('A','B','C','D')),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quiz_id, orden)
);

create table if not exists public.quiz_intentos_clase (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes_clase(id) on delete cascade,
  matricula_id bigint not null references public.matriculas(id) on delete cascade,
  estudiante_id uuid null,
  respuestas jsonb not null default '[]'::jsonb,
  respuestas_correctas integer not null default 0,
  total_preguntas integer not null,
  calificacion numeric(5,2) not null,
  enviado_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quiz_id, matricula_id)
);

create index if not exists idx_quizzes_clase_programa on public.quizzes_clase(programa_id);
create index if not exists idx_quizzes_clase_tema on public.quizzes_clase(pensum_curso_id);
create index if not exists idx_quiz_preguntas_clase_quiz on public.quiz_preguntas_clase(quiz_id, orden);
create index if not exists idx_quiz_intentos_clase_quiz on public.quiz_intentos_clase(quiz_id);
create index if not exists idx_quiz_intentos_clase_matricula on public.quiz_intentos_clase(matricula_id);

create or replace function public.tg_set_updated_at_quizzes()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_quizzes_clase on public.quizzes_clase;
create trigger trg_set_updated_at_quizzes_clase
before update on public.quizzes_clase
for each row execute function public.tg_set_updated_at_quizzes();

drop trigger if exists trg_set_updated_at_quiz_preguntas_clase on public.quiz_preguntas_clase;
create trigger trg_set_updated_at_quiz_preguntas_clase
before update on public.quiz_preguntas_clase
for each row execute function public.tg_set_updated_at_quizzes();

drop trigger if exists trg_set_updated_at_quiz_intentos_clase on public.quiz_intentos_clase;
create trigger trg_set_updated_at_quiz_intentos_clase
before update on public.quiz_intentos_clase
for each row execute function public.tg_set_updated_at_quizzes();

-- Sincroniza automáticamente el resultado del quiz hacia tabla calificaciones
create or replace function public.sync_quiz_intento_a_calificaciones()
returns trigger
language plpgsql
as $$
declare
  v_tema_id uuid;
  v_concepto text;
begin
  select q.pensum_curso_id
  into v_tema_id
  from public.quizzes_clase q
  where q.id = new.quiz_id;

  v_concepto := 'Quiz de clase';

  insert into public.calificaciones (
    matricula_id,
    tema_id,
    concepto,
    nota,
    calificacion,
    tipo_evaluacion,
    fecha_evaluacion,
    observaciones
  )
  values (
    new.matricula_id,
    v_tema_id,
    v_concepto,
    new.calificacion,
    new.calificacion,
    'quiz',
    new.enviado_at::date,
    concat('Quiz: ', new.respuestas_correctas, '/', new.total_preguntas, ' correctas')
  )
  on conflict (matricula_id, tema_id, tipo_evaluacion) do update
    set nota = excluded.nota,
        calificacion = excluded.calificacion,
        fecha_evaluacion = excluded.fecha_evaluacion,
        observaciones = excluded.observaciones;

  return new;
end;
$$;

drop trigger if exists trg_sync_quiz_intento_a_calificaciones on public.quiz_intentos_clase;
create trigger trg_sync_quiz_intento_a_calificaciones
after insert or update on public.quiz_intentos_clase
for each row execute function public.sync_quiz_intento_a_calificaciones();

-- RLS sugerido (ajustar según políticas de tu proyecto)
alter table public.quizzes_clase enable row level security;
alter table public.quiz_preguntas_clase enable row level security;
alter table public.quiz_intentos_clase enable row level security;

-- lectura para usuarios autenticados
drop policy if exists "quizzes_clase_select_auth" on public.quizzes_clase;
create policy "quizzes_clase_select_auth"
on public.quizzes_clase for select
to authenticated
using (true);

drop policy if exists "quiz_preguntas_clase_select_auth" on public.quiz_preguntas_clase;
create policy "quiz_preguntas_clase_select_auth"
on public.quiz_preguntas_clase for select
to authenticated
using (true);

drop policy if exists "quiz_intentos_clase_select_auth" on public.quiz_intentos_clase;
create policy "quiz_intentos_clase_select_auth"
on public.quiz_intentos_clase for select
to authenticated
using (true);

-- gestión para roles administrativos (usa tabla perfiles)
drop policy if exists "quizzes_clase_manage_admin" on public.quizzes_clase;
create policy "quizzes_clase_manage_admin"
on public.quizzes_clase for all
to authenticated
using (
  exists (
    select 1 from public.perfiles p
    where p.id = auth.uid()
      and lower(coalesce(p.rol, '')) in ('admin', 'director', 'secretaria')
  )
)
with check (
  exists (
    select 1 from public.perfiles p
    where p.id = auth.uid()
      and lower(coalesce(p.rol, '')) in ('admin', 'director', 'secretaria')
  )
);

drop policy if exists "quiz_preguntas_clase_manage_admin" on public.quiz_preguntas_clase;
create policy "quiz_preguntas_clase_manage_admin"
on public.quiz_preguntas_clase for all
to authenticated
using (
  exists (
    select 1 from public.perfiles p
    where p.id = auth.uid()
      and lower(coalesce(p.rol, '')) in ('admin', 'director', 'secretaria')
  )
)
with check (
  exists (
    select 1 from public.perfiles p
    where p.id = auth.uid()
      and lower(coalesce(p.rol, '')) in ('admin', 'director', 'secretaria')
  )
);

-- cada estudiante puede registrar/ver su intento
drop policy if exists "quiz_intentos_insert_own" on public.quiz_intentos_clase;
create policy "quiz_intentos_insert_own"
on public.quiz_intentos_clase for insert
to authenticated
with check (estudiante_id = auth.uid());

drop policy if exists "quiz_intentos_update_own" on public.quiz_intentos_clase;
create policy "quiz_intentos_update_own"
on public.quiz_intentos_clase for update
to authenticated
using (estudiante_id = auth.uid())
with check (estudiante_id = auth.uid());

drop policy if exists "quiz_intentos_select_own_or_admin" on public.quiz_intentos_clase;
create policy "quiz_intentos_select_own_or_admin"
on public.quiz_intentos_clase for select
to authenticated
using (
  estudiante_id = auth.uid()
  or exists (
    select 1 from public.perfiles p
    where p.id = auth.uid()
      and lower(coalesce(p.rol, '')) in ('admin', 'director', 'secretaria', 'profesor')
  )
);

-- importante: para usar ON CONFLICT de sincronización, se recomienda este índice único en calificaciones
-- crea solo si no existe una restricción equivalente
create unique index if not exists uq_calificaciones_quiz
  on public.calificaciones (matricula_id, tema_id, tipo_evaluacion)
  where tipo_evaluacion = 'quiz';
