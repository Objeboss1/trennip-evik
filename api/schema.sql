create table if not exists kasutajad (
  id bigserial primary key,
  email text not null unique,
  parool_hash text not null,
  paevik jsonb not null default '{}'::jsonb,
  loodud timestamptz not null default now(),
  uuendatud timestamptz not null default now(),
  constraint kasutajad_paevik_object check (jsonb_typeof(paevik) = 'object')
);
