begin;
create table public.moa_calendar_jobs (
 owner_id uuid primary key references public.moa_google_connections(owner_id) on delete cascade,
 next_run timestamptz not null default now(),
 version bigint not null default 0,
 lease_id uuid,
 lease_until timestamptz,
 last_success timestamptz,
 last_error text
);
create table public.moa_calendar_channels (
 id uuid primary key,
 owner_id uuid not null references public.moa_google_connections(owner_id) on delete cascade,
 calendar_id text not null,
 token_hash text not null,
 resource_id text,
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create index on public.moa_calendar_channels(owner_id,expires_at);
alter table public.moa_calendar_jobs enable row level security;
alter table public.moa_calendar_channels enable row level security;
revoke all on public.moa_calendar_jobs,public.moa_calendar_channels from anon,authenticated;
grant all on public.moa_calendar_jobs,public.moa_calendar_channels to service_role;

create function public.moa_enqueue_calendar(p_owner uuid) returns void language sql security definer set search_path=public as $$
 insert into moa_calendar_jobs(owner_id) values(p_owner)
 on conflict(owner_id) do update set next_run=now(),version=moa_calendar_jobs.version+1;
$$;
create function public.moa_calendar_connection_changed() returns trigger language plpgsql security definer set search_path=public as $$
begin
 perform moa_enqueue_calendar(new.owner_id);
 return new;
end $$;
create trigger moa_calendar_connection_job after insert or update on public.moa_google_connections
 for each row execute function public.moa_calendar_connection_changed();
insert into public.moa_calendar_jobs(owner_id) select owner_id from public.moa_google_connections;

create function public.moa_claim_calendar() returns setof public.moa_calendar_jobs language sql security definer set search_path=public as $$
 update moa_calendar_jobs set lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes'
 where owner_id=(select owner_id from moa_calendar_jobs where next_run<=now()
 and (lease_until is null or lease_until<now()) order by next_run for update skip locked limit 1)
 returning *;
$$;
create function public.moa_finish_calendar(p_owner uuid,p_lease uuid,p_version bigint,p_ok boolean) returns void
 language sql security definer set search_path=public as $$
 update moa_calendar_jobs set lease_id=null,lease_until=null,
 next_run=case when version<>p_version then now() when p_ok then now()+interval '5 minutes' else now()+interval '1 minute' end,
 last_success=case when p_ok then now() else last_success end,
 last_error=case when p_ok then null else 'calendar_sync_failed' end
 where owner_id=p_owner and lease_id=p_lease;
$$;
revoke all on function public.moa_enqueue_calendar(uuid),public.moa_claim_calendar(),public.moa_finish_calendar(uuid,uuid,bigint,boolean),public.moa_calendar_connection_changed() from public,anon,authenticated;
grant execute on function public.moa_enqueue_calendar(uuid),public.moa_claim_calendar(),public.moa_finish_calendar(uuid,uuid,bigint,boolean) to service_role;
commit;
