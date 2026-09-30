begin;
create table public.moa_polls(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null,description text not null default '',duration integer not null check(duration in (15,30,60)),
 meeting_mode text not null default 'online' check(meeting_mode in ('online','offline')),
 expected_count integer not null check(expected_count between 1 and 100),candidates text[] not null,
 status text not null default 'open' check(status in ('open','confirmed','cancelled')),
 selected_slot text,booking_id uuid references moa_bookings(id),revision integer not null default 0,created_at timestamptz not null default now()
);
create table public.moa_poll_responses(
 id uuid primary key,poll_id uuid not null references moa_polls(id) on delete cascade,
 key_hash text not null,name text not null,email text not null,choices text[] not null,updated_at timestamptz not null default now(),unique(poll_id,email)
);
alter table public.moa_polls enable row level security;
alter table public.moa_poll_responses enable row level security;
revoke all on public.moa_polls,public.moa_poll_responses from anon,authenticated;
grant all on public.moa_polls,public.moa_poll_responses to service_role;
alter table moa_notification_jobs drop constraint moa_notification_jobs_recipient_role_check;
alter table moa_notification_jobs add constraint moa_notification_jobs_recipient_role_check check(recipient_role in ('guest','host') or recipient_role ~ '^poll:[0-9a-f-]{36}$');
create function public.moa_vote_poll(p_poll uuid,p_id uuid,p_key text,p_name text,p_email text,p_choices text[]) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare p moa_polls%rowtype; old moa_poll_responses%rowtype;
begin
 select * into p from moa_polls where id=p_poll for update;
 if not found or p.status<>'open' then raise exception 'poll_closed';end if;
 if not p_choices <@ p.candidates or length(p_key)<>64 or length(p_name) not between 1 and 80 or length(p_email)>200 then raise exception 'invalid_response';end if;
 select * into old from moa_poll_responses where id=p_id;
 if found then
  if old.poll_id<>p_poll or old.key_hash<>p_key then raise exception 'response_exists';end if;
  update moa_poll_responses set name=p_name,email=p_email,choices=p_choices,updated_at=now() where id=p_id;
 else
  if (select count(*) from moa_poll_responses where poll_id=p_poll)>=100 or exists(select 1 from moa_poll_responses where poll_id=p_poll and email=p_email) then raise exception 'response_exists';end if;
  insert into moa_poll_responses values(p_id,p_poll,p_key,p_name,p_email,p_choices,now());
 end if;
 update moa_polls set revision=revision+1 where id=p_poll;
end $$;
create function public.moa_confirm_poll(p_poll uuid,p_owner uuid,p_revision integer,p_workspace_revision integer,p_slot text,p_mode text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare p moa_polls%rowtype; wr integer; n integer; start_time timestamptz; end_time timestamptz; b jsonb; bid uuid; host_email text;
begin
 if p_mode not in ('off','dry-run','live') then raise exception 'invalid_mode';end if;
 insert into moa_workspaces(owner_id) values(p_owner) on conflict do nothing;
 select revision into wr from moa_workspaces where owner_id=p_owner for update;
 select * into p from moa_polls where id=p_poll and owner_id=p_owner for update;
 if not found then raise exception 'not_found';end if;
 if p.status='confirmed' and p.selected_slot=p_slot then return p.booking_id;end if;
 if p.status<>'open' or p.revision<>p_revision or wr<>p_workspace_revision then raise exception 'stale_revision';end if;
 select count(*) into n from moa_poll_responses where poll_id=p.id;
 if n<p.expected_count or not p_slot=any(p.candidates) or exists(select 1 from moa_poll_responses where poll_id=p.id and not p_slot=any(choices)) then raise exception 'not_unanimous';end if;
 start_time=(p_slot||':00+09:00')::timestamptz;end_time=start_time+make_interval(mins=>p.duration);
 if start_time<=now() then raise exception 'invalid_time';end if;
 if exists(select 1 from moa_bookings where owner_id=p_owner and status='confirmed' and starts_at<end_time+make_interval(mins=>case when p.meeting_mode='offline' or payload->>'meetingMode'='offline' then 60 else 0 end) and ends_at>start_time-make_interval(mins=>case when p.meeting_mode='offline' or payload->>'meetingMode'='offline' then 60 else 0 end)) then raise exception 'overlapping_booking';end if;
 bid=gen_random_uuid();select email into host_email from auth.users where id=p_owner;
 b=jsonb_build_object('id',bid,'eventId','poll-'||p.id,'pollId',p.id,'title',p.title,'duration',p.duration,'meetingMode',p.meeting_mode,'day',left(p_slot,10),'time',right(p_slot,5),'name','일정 투표 참석자 '||n||'명','email',host_email,'phone','','channels',jsonb_build_array('email'),'notificationConsent',true);
 insert into moa_bookings(id,owner_id,payload,starts_at,ends_at,status) values(bid,p_owner,b,start_time,end_time,'confirmed');
 update moa_polls set status='confirmed',selected_slot=p_slot,booking_id=bid,revision=revision+1 where id=p.id;
 update moa_workspaces set revision=revision+1,updated_at=now() where owner_id=p_owner;
 perform moa_enqueue(p_owner,b,'confirmed',p_mode);
 return bid;
end $$;
create function public.moa_poll_booking_cancelled() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.status='cancelled' and old.status<>'cancelled' and new.payload ? 'pollId' then update moa_polls set status='cancelled',revision=revision+1 where id=(new.payload->>'pollId')::uuid;end if;return new;
end $$;
create trigger moa_poll_booking_cancelled after update of status on moa_bookings for each row execute function moa_poll_booking_cancelled();
revoke all on function moa_vote_poll(uuid,uuid,text,text,text,text[]),moa_confirm_poll(uuid,uuid,integer,integer,text,text),moa_poll_booking_cancelled() from public,anon,authenticated;
grant execute on function moa_vote_poll(uuid,uuid,text,text,text,text[]),moa_confirm_poll(uuid,uuid,integer,integer,text,text) to service_role;
create or replace function public.moa_enqueue(p_owner uuid,p_booking jsonb,p_event text,p_mode text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare channel_name text; host_email text;
begin
  if p_booking ? 'pollId' then
    select email into host_email from auth.users where id=p_owner;
    insert into moa_notification_jobs(owner_id,booking_id,event_type,channel,recipient_role,destination,payload,mode,status)
    values(p_owner,(p_booking->>'id')::uuid,p_event,'email','host',host_email,p_booking,p_mode,case when p_mode='off' then 'disabled' else 'pending' end) on conflict(booking_id,event_type,channel,recipient_role) do nothing;
    insert into moa_notification_jobs(owner_id,booking_id,event_type,channel,recipient_role,destination,payload,mode,status)
    select p_owner,(p_booking->>'id')::uuid,p_event,'email','poll:'||r.id,r.email,p_booking||jsonb_build_object('name',r.name,'email',r.email),p_mode,case when p_mode='off' then 'disabled' else 'pending' end from moa_poll_responses r where r.poll_id=(p_booking->>'pollId')::uuid and r.email<>host_email on conflict(booking_id,event_type,channel,recipient_role) do nothing;
    return;
  end if;
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


commit;
