-- Per-page guest rules: minimum notice and a daily booking limit (event.availability.minNoticeHours / dailyLimit).
-- The app already hides slots that break them; this trigger is the race-safe check. Every booking writer locks the
-- host's workspace row first, so two simultaneous guests cannot both take the last slot of a day.
-- Host-initiated reschedules (agreed with the guest) skip the rules via a transaction-local setting.
create or replace function public.moa_enforce_booking_rules() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare ev jsonb; notice integer; lim integer; n integer;
begin
 if new.status<>'confirmed' or coalesce(current_setting('moa.skip_booking_rules',true),'')='on' then return new; end if;
 select e.value into ev from moa_workspaces w cross join lateral jsonb_array_elements(w.data->'events') e
  where w.owner_id=new.owner_id and e.value->>'id'=new.payload->>'eventId';
 if ev is null or not (ev ? 'availability') then return new; end if;
 notice=coalesce(nullif(ev->'availability'->>'minNoticeHours','')::integer,0);
 if notice>0 and new.starts_at<now()+make_interval(hours=>notice) then raise exception 'min_notice'; end if;
 lim=coalesce(nullif(ev->'availability'->>'dailyLimit','')::integer,0);
 if lim>0 then
  select count(*) into n from moa_bookings where owner_id=new.owner_id and status='confirmed' and id<>new.id
   and payload->>'eventId'=new.payload->>'eventId' and payload->>'day'=new.payload->>'day';
  if n>=lim then raise exception 'daily_limit'; end if;
 end if;
 return new;
end $$;
revoke all on function public.moa_enforce_booking_rules() from public,anon,authenticated;
drop trigger if exists moa_enforce_booking_rules on public.moa_bookings;
create trigger moa_enforce_booking_rules before insert on public.moa_bookings
 for each row execute function public.moa_enforce_booking_rules();

-- Same as 202610120001 plus the rule bypass: a host who agreed a time with the guest may override page limits.
create or replace function public.moa_host_reschedule(p_owner uuid,p_booking uuid,p_new_id uuid,p_day text,p_time text,p_mode text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare ws moa_workspaces%rowtype; oldrow moa_bookings%rowtype; start_time timestamptz; end_time timestamptz; b jsonb; offline boolean;
begin
 if p_mode not in ('off','dry-run','live') then raise exception 'invalid_mode'; end if;
 perform set_config('moa.skip_booking_rules','on',true);
 -- Same lock order as every other booking writer: workspace, then booking.
 select * into ws from moa_workspaces where owner_id=p_owner for update;
 if not found then raise exception 'not_found'; end if;
 select * into oldrow from moa_bookings where id=p_booking and owner_id=p_owner for update;
 if not found then raise exception 'not_found'; end if;
 if oldrow.replaced_by is not null then
  -- A retried request with the same id and time is a success, anything else is a conflict.
  if oldrow.replaced_by=p_new_id and exists(select 1 from moa_bookings where id=p_new_id and payload->>'day'=p_day and payload->>'time'=p_time) then return p_new_id; end if;
  raise exception 'booking_changed';
 end if;
 if oldrow.status<>'confirmed' then raise exception 'booking_cancelled'; end if;
 if oldrow.payload ? 'pollId' then raise exception 'poll_booking'; end if;
 if oldrow.starts_at<=now() then raise exception 'booking_started'; end if;
 if p_new_id is null or exists(select 1 from moa_bookings where id=p_new_id) then raise exception 'duplicate_booking'; end if;
 if p_day !~ '^\d{4}-\d{2}-\d{2}$' or p_time !~ '^([01]\d|2[0-3]):[0-5]\d$' then raise exception 'invalid_time'; end if;
 if p_day=oldrow.payload->>'day' and p_time=oldrow.payload->>'time' then raise exception 'same_time'; end if;
 start_time=(p_day||'T'||p_time||':00+09:00')::timestamptz;
 if start_time<=now() or p_day::date>(now() at time zone 'Asia/Seoul')::date+365 then raise exception 'invalid_time'; end if;
 end_time=start_time+(oldrow.ends_at-oldrow.starts_at);
 offline=oldrow.payload->>'meetingMode'='offline';
 if exists(select 1 from moa_bookings where owner_id=p_owner and status='confirmed' and id<>p_booking
   and starts_at<end_time+make_interval(mins=>case when offline or payload->>'meetingMode'='offline' then 60 else 0 end)
   and ends_at>start_time-make_interval(mins=>case when offline or payload->>'meetingMode'='offline' then 60 else 0 end)) then
  raise exception 'overlapping_booking';
 end if;
 b=oldrow.payload||jsonb_build_object('id',p_new_id,'day',p_day,'time',p_time,'channels',jsonb_build_array('email'));
 -- Cancel first so an overlapping move never sees two confirmed rows; link after the new row exists (FK).
 update moa_bookings set status='cancelled' where id=p_booking;
 insert into moa_bookings(id,owner_id,payload,starts_at,ends_at,status) values(p_new_id,p_owner,b,start_time,end_time,'confirmed');
 update moa_bookings set replaced_by=p_new_id where id=p_booking;
 perform moa_enqueue(p_owner,b,'confirmed',p_mode);
 -- The change details live only on the notices; booking payloads stay within the strict booking schema.
 update moa_notification_jobs set payload=payload||jsonb_build_object('previousDay',oldrow.payload->>'day','previousTime',oldrow.payload->>'time','changedBy','host')
  where booking_id=p_new_id and event_type='confirmed';
 update moa_workspaces set revision=revision+1,updated_at=now() where owner_id=p_owner;
 return p_new_id;
end $$;
revoke all on function public.moa_host_reschedule(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.moa_host_reschedule(uuid,uuid,uuid,text,text,text) to service_role;
