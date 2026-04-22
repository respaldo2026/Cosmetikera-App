create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  expiration_time bigint null,
  perfil_id uuid null references public.perfiles(id) on delete set null,
  user_agent text null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_web_push_subscriptions_perfil_id
  on public.web_push_subscriptions(perfil_id);

create index if not exists idx_web_push_subscriptions_active
  on public.web_push_subscriptions(active);
