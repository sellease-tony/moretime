-- Preserve the workspace row lock: selected slots and cross-page conflicts are validated atomically.
-- Legacy events retain the old DB rule during the application rollout. New API requires saved availability.
begin;
create or replace function public.moa_save_workspace(p_owner uuid,p_revision integer,p_state jsonb,p_bookings jsonb,p_mode text)
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
    if event_data ? 'availability' then
      if start_time<=now() or not coalesce((event_data->'availability'->'days'->(b->>'day')) ? (b->>'time'),false) then raise exception 'invalid_time'; end if;
    elsif start_time<=now() or not coalesce((p_state->'hours'->>weekday)::boolean,false)
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

commit;
