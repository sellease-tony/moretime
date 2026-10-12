-- Host-initiated reschedule (e.g. agreed by phone). Unlike guest self-service, the host may pick a time outside
-- the page's open slots, but overlaps with other confirmed bookings (and the offline travel buffer) are still
-- refused. The old booking is cancelled without a cancellation notice; both parties get a "changed" email.
create or replace function public.moa_host_reschedule(p_owner uuid,p_booking uuid,p_new_id uuid,p_day text,p_time text,p_mode text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare ws moa_workspaces%rowtype; oldrow moa_bookings%rowtype; start_time timestamptz; end_time timestamptz; b jsonb; offline boolean;
begin
 if p_mode not in ('off','dry-run','live') then raise exception 'invalid_mode'; end if;
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
