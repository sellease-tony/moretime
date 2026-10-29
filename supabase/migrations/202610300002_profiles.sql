-- Personal booking addresses: moretime.sellease.io/{handle}/{page slug}. Service role only; looked up server-side.
begin;
create table if not exists public.moa_profiles(
 owner_id uuid primary key references auth.users(id) on delete cascade,
 handle text not null unique check(handle ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$' and handle !~ '--'),
 updated_at timestamptz not null default now()
);
alter table public.moa_profiles enable row level security;
revoke all on public.moa_profiles from anon,authenticated;
commit;
