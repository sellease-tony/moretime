-- Google Meet link created with the host's calendar event for online bookings. Kept beside the booking payload
-- (not inside it) so host saves, which validate payloads strictly, never round-trip it.
alter table public.moa_bookings add column if not exists meet_url text;
