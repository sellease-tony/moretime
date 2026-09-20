-- Apply once in a new Supabase project's SQL Editor. Existing D1 data is not imported.
begin;
create table public.moa_workspaces (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  revision integer not null default 0,
  updated_at timestamptz not null default now()
);
create table public.moa_bookings (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null check(status in ('confirmed','cancelled')),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  check(ends_at>starts_at)
);
create index moa_bookings_owner_active on public.moa_bookings(owner_id,starts_at) where status='confirmed';
create table public.moa_notification_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  booking_id uuid not null references public.moa_bookings(id) on delete cascade,
  event_type text not null check(event_type in ('confirmed','cancelled')),
  channel text not null check(channel in ('email','sms','kakao')),
  recipient_role text not null default 'guest' check(recipient_role in ('guest','host')),
  destination text not null,
  payload jsonb not null,
  mode text not null check(mode in ('off','dry-run','live')),
  status text not null default 'pending' check(status in ('pending','processing','accepted','failed','unknown','simulated','disabled','expired','superseded','blocked')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_until timestamptz,
  lease_token uuid,
  provider_id text,
  last_error text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '23 hours',
  updated_at timestamptz not null default now(),
  unique(booking_id,event_type,channel,recipient_role)
);
create index moa_jobs_pending on public.moa_notification_jobs(available_at) where status='pending';
create index moa_jobs_owner on public.moa_notification_jobs(owner_id,created_at desc);
alter table public.moa_workspaces enable row level security;
alter table public.moa_bookings enable row level security;
alter table public.moa_notification_jobs enable row level security;
create policy owner_read on public.moa_workspaces for select to authenticated using(owner_id=auth.uid());
create policy owner_read on public.moa_bookings for select to authenticated using(owner_id=auth.uid());
create policy owner_read on public.moa_notification_jobs for select to authenticated using(owner_id=auth.uid());
revoke all on public.moa_workspaces,public.moa_bookings,public.moa_notification_jobs from anon,authenticated;
grant select on public.moa_workspaces,public.moa_bookings,public.moa_notification_jobs to authenticated;
grant all on public.moa_workspaces,public.moa_bookings,public.moa_notification_jobs to service_role;

create function public.moa_enqueue(p_owner uuid,p_booking jsonb,p_event text,p_mode text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare channel_name text; host_email text;
begin
  -- Transactional email goes to both participants. SMS/Kakao require explicit opt-in.
  for channel_name in select distinct value from jsonb_array_elements_text(coalesce(p_booking->'channels','[]'::jsonb)||'["email"]'::jsonb) loop
    if channel_name<>'email' and not coalesce((p_booking->>'notificationConsent')::boolean,false) then continue; end if;
    insert into public.moa_notification_jobs(owner_id,booking_id,event_type,channel,destination,payload,mode,status)
    values(p_owner,(p_booking->>'id')::uuid,p_event,channel_name,
      case when channel_name='email' then p_booking->>'email' else p_booking->>'phone' end,
      p_booking,p_mode,case when p_mode='off' then 'disabled' else 'pending' end)
    on conflict(booking_id,event_type,channel,recipient_role) do nothing;
  end loop;
  select email into host_email from auth.users where id=p_owner;
  if host_email is not null and lower(host_email)<>lower(p_booking->>'email') then
    insert into public.moa_notification_jobs(owner_id,booking_id,event_type,channel,recipient_role,destination,payload,mode,status)
    values(p_owner,(p_booking->>'id')::uuid,p_event,'email','host',host_email,p_booking,p_mode,case when p_mode='off' then 'disabled' else 'pending' end)
    on conflict(booking_id,event_type,channel,recipient_role) do nothing;
  end if;
end $$;

-- Called only by the authenticated server API using the secret key.
-- Serializing every mutation on the workspace row also prevents overlapping bookings.
create function public.moa_save_workspace(p_owner uuid,p_revision integer,p_state jsonb,p_bookings jsonb,p_mode text)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare current_revision integer; b jsonb; previous jsonb; oldrow public.moa_bookings%rowtype; start_time timestamptz; end_time timestamptz; event_data jsonb; weekday integer; span_start time; span_end time;
begin
  if p_mode not in ('off','dry-run','live') then raise exception 'invalid_mode'; end if;
  if jsonb_typeof(p_state)<>'object' or jsonb_typeof(p_bookings)<>'array' then raise exception 'invalid_data'; end if;
  insert into public.moa_workspaces(owner_id) values(p_owner) on conflict do nothing;
  select revision into current_revision from public.moa_workspaces where owner_id=p_owner for update;
  if current_revision<>p_revision then raise exception 'stale_revision'; end if;
  if jsonb_array_length(p_bookings)>500 then raise exception 'booking_limit'; end if;
  if (select count(*) from jsonb_array_elements(p_bookings))<>(select count(distinct value->>'id') from jsonb_array_elements(p_bookings)) then raise exception 'duplicate_booking'; end if;
  -- Cancellations persist their original recipient/consent snapshot and create an outbox job atomically.
  for oldrow in select * from public.moa_bookings where owner_id=p_owner and status='confirmed' loop
    if not exists(select 1 from jsonb_array_elements(p_bookings) x where x->>'id'=oldrow.id::text) then
      update public.moa_bookings set status='cancelled',cancelled_at=now() where id=oldrow.id;
      update public.moa_notification_jobs set status='superseded',updated_at=now()
        where booking_id=oldrow.id and event_type='confirmed' and status in ('pending','blocked');
      perform public.moa_enqueue(p_owner,oldrow.payload,'cancelled',p_mode);
    end if;
  end loop;
  for b in select value from jsonb_array_elements(p_bookings) loop
    select * into oldrow from public.moa_bookings where id=(b->>'id')::uuid;
    if found then
      if oldrow.owner_id<>p_owner or oldrow.status<>'confirmed' or oldrow.payload<>b then raise exception 'immutable_booking'; end if;
      continue;
    end if;
    select value into event_data from jsonb_array_elements(p_state->'events') where value->>'id'=b->>'eventId';
    if event_data is null or not (event_data->>'active')::boolean or (event_data->>'duration')::int<>(b->>'duration')::int or event_data->>'title'<>b->>'title' then raise exception 'invalid_event'; end if;
    start_time=((b->>'day')||'T'||(b->>'time')||':00+09:00')::timestamptz;
    end_time=start_time+make_interval(mins=>(b->>'duration')::int);
    weekday=extract(dow from start_time at time zone 'Asia/Seoul');
    span_start=(p_state->'range'->>0)::time; span_end=(p_state->'range'->>1)::time;
    if start_time<=now() or not coalesce((p_state->'hours'->>weekday)::boolean,false)
      or (start_time at time zone 'Asia/Seoul')::time<span_start
      or (end_time at time zone 'Asia/Seoul')::time>span_end
      or span_start>=span_end then raise exception 'invalid_time'; end if;
    if exists(select 1 from public.moa_bookings where owner_id=p_owner and status='confirmed' and starts_at<end_time and ends_at>start_time) then raise exception 'overlapping_booking'; end if;
    insert into public.moa_bookings(id,owner_id,payload,starts_at,ends_at,status)
      values((b->>'id')::uuid,p_owner,b,start_time,end_time,'confirmed');
    perform public.moa_enqueue(p_owner,b,'confirmed',p_mode);
  end loop;
  update public.moa_workspaces set data=p_state,revision=revision+1,updated_at=now() where owner_id=p_owner;
  return current_revision+1;
end $$;

-- Atomic claims; parallel Vercel functions never claim the same row.
create function public.moa_claim_notifications(p_limit integer default 10,p_owner uuid default null)
returns setof public.moa_notification_jobs language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.moa_notification_jobs set status='unknown',last_error='발송 중 실행이 중단되었습니다. 공급자 기록을 확인하세요.',updated_at=now()
    where status='processing' and lease_until<now() and channel in ('sms','kakao') and (p_owner is null or owner_id=p_owner);
  update public.moa_notification_jobs set status='pending',updated_at=now()
    where status='processing' and lease_until<now() and channel='email' and attempts<3 and expires_at>now() and (p_owner is null or owner_id=p_owner);
  update public.moa_notification_jobs set status='expired',updated_at=now()
    where ((status='pending' and expires_at<=now()) or (status='processing' and lease_until<now() and channel='email' and (attempts>=3 or expires_at<=now()))) and (p_owner is null or owner_id=p_owner);
  return query
    with candidates as (
      select id from public.moa_notification_jobs
      where status='pending' and available_at<=now() and expires_at>now() and (p_owner is null or owner_id=p_owner)
      order by available_at,id for update skip locked limit least(greatest(p_limit,1),20)
    ) update public.moa_notification_jobs j set status='processing',attempts=attempts+1,lease_until=now()+interval '5 minutes',lease_token=gen_random_uuid(),updated_at=now()
      from candidates c where j.id=c.id returning j.*;
end $$;
revoke all on function public.moa_enqueue(uuid,jsonb,text,text) from public,anon,authenticated;
revoke all on function public.moa_save_workspace(uuid,integer,jsonb,jsonb,text) from public,anon,authenticated;
revoke all on function public.moa_claim_notifications(integer,uuid) from public,anon,authenticated;
grant execute on function public.moa_save_workspace(uuid,integer,jsonb,jsonb,text) to service_role;
grant execute on function public.moa_claim_notifications(integer,uuid) to service_role;
commit;
