begin;
alter table public.moa_notification_jobs drop constraint moa_notification_jobs_event_type_check;
alter table public.moa_notification_jobs add constraint moa_notification_jobs_event_type_check
 check(event_type in ('confirmed','cancelled','reminder_24h','reminder_1h'));
create table public.moa_reminder_settings(
 owner_id uuid primary key references auth.users(id) on delete cascade,
 reminder_24h boolean not null default true,
 reminder_1h boolean not null default true,
 guest boolean not null default true,
 host boolean not null default true,
 updated_at timestamptz not null default now()
);
alter table public.moa_reminder_settings enable row level security;
revoke all on public.moa_reminder_settings from anon,authenticated;
grant all on public.moa_reminder_settings to service_role;
create index moa_bookings_reminder_due on public.moa_bookings(starts_at) where status='confirmed';

create function public.moa_enqueue_reminders(p_mode text) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare inserted integer;
begin
 if p_mode not in ('off','dry-run','live') then raise exception 'invalid_mode'; end if;
 if p_mode='off' then return 0; end if;
 insert into moa_notification_jobs(owner_id,booking_id,event_type,channel,recipient_role,destination,payload,mode,expires_at)
 select b.owner_id,b.id,r.kind,'email',source.recipient_role,source.destination,b.payload,
 case when source.mode='dry-run' or p_mode='dry-run' then 'dry-run' else 'live' end,
 b.starts_at-r.lead_time+r.grace_period
 from moa_bookings b
 cross join (values ('reminder_24h',interval '24 hours',interval '1 hour'),('reminder_1h',interval '1 hour',interval '15 minutes')) r(kind,lead_time,grace_period)
 join moa_notification_jobs source on source.booking_id=b.id and source.event_type='confirmed' and source.channel='email' and source.mode<>'off'
 left join moa_reminder_settings s on s.owner_id=b.owner_id
 where b.status='confirmed' and b.starts_at>now() and b.starts_at<=now()+interval '24 hours'
 and b.created_at<=b.starts_at-r.lead_time
 and now()>=b.starts_at-r.lead_time and now()<b.starts_at-r.lead_time+r.grace_period
 and case when r.kind='reminder_24h' then coalesce(s.reminder_24h,true) else coalesce(s.reminder_1h,true) end
 and case when source.recipient_role='host' then coalesce(s.host,true) else coalesce(s.guest,true) end
 on conflict(booking_id,event_type,channel,recipient_role) do nothing;
 get diagnostics inserted=row_count;
 return inserted;
end $$;
revoke all on function public.moa_enqueue_reminders(text) from public,anon,authenticated;
grant execute on function public.moa_enqueue_reminders(text) to service_role;
commit;
