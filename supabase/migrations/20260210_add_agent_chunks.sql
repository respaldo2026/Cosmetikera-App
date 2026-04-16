-- Extensión vector y chunks indexados
create extension if not exists vector;

create table if not exists agent_chunks (
  id bigserial primary key,
  doc_id bigint references agent_documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(768),
  created_at timestamptz default now()
);

-- Index para similitud
create index if not exists agent_chunks_embedding_idx on agent_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Function para búsqueda por similitud
create or replace function match_agent_chunks(query_embedding vector(768), match_count int, similarity_threshold float)
returns table(id bigint, doc_id bigint, content text, distance float) as $$
  select id, doc_id, content, (embedding <-> query_embedding) as distance
  from agent_chunks
  where embedding is not null
  and (embedding <-> query_embedding) <= similarity_threshold
  order by embedding <-> query_embedding
  limit match_count;
$$ language sql stable;
