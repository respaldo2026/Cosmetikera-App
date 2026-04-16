-- Crea lista general de materiales por ciclo y la vincula con materiales por clase
create table if not exists materiales_ciclo (
  id uuid primary key default gen_random_uuid(),
  programa_id integer not null references programas(id) on delete cascade,
  pensum_id uuid not null references pensum(id) on delete cascade,
  nombre text not null,
  cantidad text,
  incluido_kit boolean not null default false,
  orden integer not null default 1,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists materiales_ciclo_programa_id_idx on materiales_ciclo (programa_id);
create index if not exists materiales_ciclo_pensum_id_idx on materiales_ciclo (pensum_id);

alter table materiales_clase
  add column if not exists material_ciclo_id uuid references materiales_ciclo(id);
