-- Page buffers: minutes kept free before/after a meeting (payload.bufferBefore / bufferAfter, copied from the page
-- when the booking is made). The app hides slots that break them; this trigger is the race-safe check, run under the
-- same workspace lock as every booking writer. Host-initiated reschedules still skip the rules.
begin;
create or replace function public.moa_enforce_booking_rules() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare ev jsonb; notice integer; lim integer; n integer; nb integer; na integer;
begin
 if new.status<>'confirmed' or coalesce(current_setting('moa.skip_booking_rules',true),'')='on' then return new; end if;
 -- The gap before the new meeting is the larger of its own lead buffer and the earlier meeting's trailing buffer.
 nb=least(greatest(coalesce(nullif(new.payload->>'bufferBefore','')::integer,0),0),120);
 na=least(greatest(coalesce(nullif(new.payload->>'bufferAfter','')::integer,0),0),120);
 if exists(select 1 from moa_bookings o where o.owner_id=new.owner_id and o.status='confirmed' and o.id<>new.id
   and new.starts_at<o.ends_at+make_interval(mins=>greatest(nb,least(greatest(coalesce(nullif(o.payload->>'bufferAfter','')::integer,0),0),120)))
   and new.ends_at>o.starts_at-make_interval(mins=>greatest(na,least(greatest(coalesce(nullif(o.payload->>'bufferBefore','')::integer,0),0),120)))) then
  raise exception 'overlapping_booking';
 end if;
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
commit;
