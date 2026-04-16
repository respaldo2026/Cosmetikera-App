-- Configuración de prompt del agente
create table if not exists agent_settings (
  id integer primary key default 1 check (id = 1),
  system_prompt text,
  updated_at timestamptz default now()
);

-- Fila única para fácil upsert desde app
insert into agent_settings (id, system_prompt)
values (1, 'Eres Dany, asistente de la academia. Responde solo con datos ciertos; si falta info, di que lo consultas y no inventes.')
on conflict (id) do nothing;
