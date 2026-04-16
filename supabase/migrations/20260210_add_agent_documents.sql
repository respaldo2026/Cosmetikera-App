-- Documentos de conocimiento para el agente (PDF/texto)
create table if not exists agent_documents (
  id bigserial primary key,
  title text not null,
  source_url text,
  content_text text,
  summary text,
  keywords text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Índice simple por título
create index if not exists agent_documents_title_idx on agent_documents using gin (to_tsvector('spanish', title));
