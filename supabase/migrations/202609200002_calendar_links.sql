begin;
create table public.moa_google_connections(
  owner_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token_enc text not null,
  updated_at timestamptz not null default now()
);
alter table public.moa_google_connections enable row level security;
revoke all on public.moa_google_connections from anon,authenticated;
grant all on public.moa_google_connections to service_role;
create table public.moa_public_links(
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null,
  unique(owner_id,event_id)
);
alter table public.moa_public_links enable row level security;
revoke all on public.moa_public_links from anon,authenticated;
grant all on public.moa_public_links to service_role;
create index moa_links_owner on public.moa_public_links(owner_id);
commit;
