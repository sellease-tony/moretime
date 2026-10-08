-- Hosts are marked in app_metadata so guests who sign in only to prefill a booking cannot use the workspace.
-- Backfill existing hosts: every host consent login stored a calendar connection.
update auth.users u set raw_app_meta_data=coalesce(u.raw_app_meta_data,'{}'::jsonb)||'{"moa_role":"host"}'::jsonb
where exists(select 1 from public.moa_google_connections c where c.owner_id=u.id);
