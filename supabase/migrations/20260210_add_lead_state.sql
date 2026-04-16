-- Track last course context per lead (by phone) for conversational replies
create table if not exists lead_state (
  phone text primary key,
  last_curso_id integer,
  last_updated timestamptz default now()
);
