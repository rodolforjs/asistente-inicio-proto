-- suscripciones de los celulares de la demo; solo la función (service role) las lee
create table if not exists public.push_subs (
  endpoint text primary key,
  sala text not null,
  sub jsonb not null,
  ua text,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_sala on public.push_subs (sala, created_at desc);
alter table public.push_subs enable row level security;
