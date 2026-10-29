-- Outlook / Microsoft 365 calendars. A host has one calendar connection, Google or Microsoft; the table keeps its
-- original name because background jobs and channels reference it.
begin;
alter table public.moa_google_connections add column if not exists provider text not null default 'google' check(provider in ('google','microsoft'));
-- Microsoft Graph assigns event IDs, so the booking remembers the event it created (Google events use a deterministic ID).
alter table public.moa_bookings add column if not exists calendar_event_id text;
commit;
