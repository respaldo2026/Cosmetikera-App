-- Crear tabla para guardar conversaciones del agente con memoria
create table if not exists public.agent_conversations (
  id uuid default gen_random_uuid() primary key,
  phone_number text not null,
  user_message text not null,
  agent_response text not null,
  transcription text, -- Para audio STT
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Índice para búsquedas rápidas por teléfono
create index if not exists idx_agent_conversations_phone on public.agent_conversations(phone_number);

-- RLS: Permitir que el servicio role y admins lean/escriban
alter table public.agent_conversations enable row level security;

drop policy if exists "Service role y admins pueden acceder conversaciones" on public.agent_conversations;
create policy "Service role y admins pueden acceder conversaciones"
  on public.agent_conversations
  for all
  to authenticated
  using (
    auth.role() = 'service_role'
    or auth.uid() in (
      select id from public.perfiles where rol in ('desarrollo', 'administrador', 'admin', 'director')
    )
  )
  with check (
    auth.role() = 'service_role'
    or auth.uid() in (
      select id from public.perfiles where rol in ('desarrollo', 'administrador', 'admin', 'director')
    )
  );
