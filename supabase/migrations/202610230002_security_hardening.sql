-- Security review follow-ups (2026-10-23).
begin;

-- Billing tables: drop every leftover default privilege (TRUNCATE ignores RLS), then grant back only the columns hosts may read.
revoke all on public.moa_subscriptions,public.moa_payments from authenticated;
grant select(owner_id,plan,status,billing_cycle,current_period_end,trial_ends_at,cancel_at_period_end,created_at,updated_at) on public.moa_subscriptions to authenticated;
grant select(id,owner_id,order_id,amount,refunded_amount,status,billing_cycle,period_start,period_end,failure_reason,created_at) on public.moa_payments to authenticated;

-- SECURITY DEFINER functions resolve names only in public, never in a caller's temp schema.
do $$
declare f record;
begin
 for f in select p.oid::regprocedure as sig from pg_proc p
  where p.pronamespace='public'::regnamespace and p.proname like 'moa\_%' and p.prosecdef
   and not coalesce(array_to_string(p.proconfig,',') like '%pg_temp%',false)
 loop
  execute format('alter function %s set search_path=public,pg_temp',f.sig);
 end loop;
end $$;

-- One poll response per person regardless of email case (the API also lowercases).
create unique index if not exists moa_poll_responses_email_ci on public.moa_poll_responses(poll_id,lower(email));

commit;
