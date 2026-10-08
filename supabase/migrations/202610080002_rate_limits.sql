-- Fixed-window request counters for public endpoints (guest booking, poll votes). Buckets hold hashed keys only.
create table if not exists public.moa_rate_limits(
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key(bucket,window_start)
);
alter table public.moa_rate_limits enable row level security;
revoke all on public.moa_rate_limits from anon,authenticated;
grant all on public.moa_rate_limits to service_role;

-- Counts one hit in every bucket and returns false when any bucket is over its limit.
create or replace function public.moa_hit_rate_limits(p_buckets text[],p_limits integer[],p_window_seconds integer)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare
  w timestamptz;n integer;allowed boolean:=true;
begin
  if p_window_seconds<1 or coalesce(array_length(p_buckets,1),0)=0 or array_length(p_buckets,1)<>array_length(p_limits,1) then raise exception 'invalid_rate_limit'; end if;
  w:=to_timestamp(floor(extract(epoch from now())/p_window_seconds)*p_window_seconds);
  for i in 1..array_length(p_buckets,1) loop
    insert into public.moa_rate_limits(bucket,window_start,hits) values(p_buckets[i],w,1)
      on conflict(bucket,window_start) do update set hits=public.moa_rate_limits.hits+1
      returning hits into n;
    if n>p_limits[i] then allowed:=false; end if;
  end loop;
  -- Opportunistic cleanup keeps the table small without a separate scheduler.
  if random()<0.02 then delete from public.moa_rate_limits where window_start<now()-interval '1 day'; end if;
  return allowed;
end $$;
revoke all on function public.moa_hit_rate_limits(text[],integer[],integer) from public,anon,authenticated;
grant execute on function public.moa_hit_rate_limits(text[],integer[],integer) to service_role;
