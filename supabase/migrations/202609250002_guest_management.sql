begin;
alter table public.moa_bookings add column replaced_by uuid references public.moa_bookings(id);
alter table public.moa_bookings add column calendar_pending boolean not null default false;

create function public.moa_booking_calendar_pending() returns trigger language plpgsql security definer set search_path=public as $$
begin
 new.calendar_pending=true;
 if exists(select 1 from moa_google_connections where owner_id=new.owner_id) then perform moa_enqueue_calendar(new.owner_id); end if;
 return new;
end $$;
create trigger moa_booking_calendar_pending before insert or update of status on public.moa_bookings
 for each row execute function public.moa_booking_calendar_pending();
revoke all on function public.moa_booking_calendar_pending() from public,anon,authenticated;

create function public.moa_manage_booking(p_booking uuid,p_action text,p_new_id uuid,p_day text,p_time text,p_mode text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare oldrow moa_bookings%rowtype; ws moa_workspaces%rowtype; bs jsonb; replacement jsonb; ev jsonb; target_owner uuid;
begin
 if p_action not in ('cancel','reschedule') then raise exception 'invalid_action'; end if;
 select owner_id into target_owner from moa_bookings where id=p_booking;
 if not found then raise exception 'not_found'; end if;
 -- Same lock order as all other booking writers.
 select * into ws from moa_workspaces where owner_id=target_owner for update;
 select * into oldrow from moa_bookings where id=p_booking for update;
 if oldrow.replaced_by is not null then
  if p_action='reschedule' and oldrow.replaced_by=p_new_id and exists(
   select 1 from moa_bookings where id=p_new_id and payload->>'day'=p_day and payload->>'time'=p_time
  ) then return p_new_id; end if;
  raise exception 'booking_changed';
 end if;
 if oldrow.status='cancelled' then
  if p_action='cancel' then return p_booking; end if;
  raise exception 'booking_cancelled';
 end if;
 if oldrow.starts_at<=now() then raise exception 'booking_started'; end if;
 select coalesce(jsonb_agg(payload),'[]'::jsonb) into bs from moa_bookings
 where owner_id=target_owner and status='confirmed' and id<>p_booking;
 if p_action='reschedule' then
  if p_new_id is null or exists(select 1 from moa_bookings where id=p_new_id) then raise exception 'duplicate_booking'; end if;
  if p_day !~ '^\d{4}-\d{2}-\d{2}$' or p_time !~ '^([01]\d|2[0-3]):[0-5]\d$'
   or p_day::date>(now() at time zone 'Asia/Seoul')::date+90 then raise exception 'invalid_time'; end if;
  if p_day=oldrow.payload->>'day' and p_time=oldrow.payload->>'time' then raise exception 'same_time'; end if;
  select value into ev from jsonb_array_elements(ws.data->'events') where value->>'id'=oldrow.payload->>'eventId';
  if ev is null or not coalesce((ev->>'active')::boolean,false) or not (ev ? 'availability') then raise exception 'invalid_event'; end if;
  replacement=oldrow.payload||jsonb_build_object('id',p_new_id,'day',p_day,'time',p_time,'title',ev->>'title','duration',(ev->>'duration')::int);
  bs=bs||jsonb_build_array(replacement);
 end if;
 -- Cancellation, conflict checks, insertion and outbox are one transaction.
 perform moa_save_workspace(target_owner,ws.revision,ws.data,bs,p_mode);
 if p_action='reschedule' then
  update moa_bookings set replaced_by=p_new_id where id=p_booking;
  update moa_notification_jobs set status='superseded' where booking_id=p_booking and event_type='cancelled';
  update moa_notification_jobs set payload=payload||jsonb_build_object('previousDay',oldrow.payload->>'day','previousTime',oldrow.payload->>'time')
   where booking_id=p_new_id and event_type='confirmed';
  return p_new_id;
 end if;
 return p_booking;
end $$;
revoke all on function public.moa_manage_booking(uuid,text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.moa_manage_booking(uuid,text,uuid,text,text,text) to service_role;
commit;
