-- Plans, payments and the back-office audit trail. Only the service role writes these tables; hosts may read their own rows.

create table public.moa_subscriptions(
 owner_id uuid primary key references auth.users(id) on delete cascade,
 plan text not null default 'free' check(plan in ('free','pro')),
 -- trialing: free trial; active: paid; past_due: last charge failed; canceled: ended or downgraded; comped: granted by an admin
 status text not null default 'active' check(status in ('trialing','active','past_due','canceled','comped')),
 billing_cycle text check(billing_cycle in ('monthly','yearly')),
 current_period_end timestamptz,
 trial_ends_at timestamptz,
 cancel_at_period_end boolean not null default false,
 toss_customer_key text unique,
 billing_key_enc text,
 note text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table public.moa_payments(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 order_id text not null unique,
 payment_key text unique,
 amount integer not null check(amount>=0),
 refunded_amount integer not null default 0 check(refunded_amount>=0 and refunded_amount<=amount),
 status text not null check(status in ('paid','failed','refunded','partially_refunded')),
 billing_cycle text check(billing_cycle in ('monthly','yearly')),
 period_start timestamptz,
 period_end timestamptz,
 failure_reason text,
 created_at timestamptz not null default now()
);
create index moa_payments_owner_idx on public.moa_payments(owner_id,created_at desc);

create table public.moa_admin_audit(
 id bigint generated always as identity primary key,
 admin_id uuid not null,
 admin_email text not null,
 action text not null,
 target_owner uuid,
 detail jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index moa_admin_audit_created_idx on public.moa_admin_audit(created_at desc);

alter table public.moa_subscriptions enable row level security;
alter table public.moa_payments enable row level security;
alter table public.moa_admin_audit enable row level security;
-- The billing key never leaves the server: hosts read their plan through these policies, but select only safe columns in app code.
create policy moa_subscriptions_owner_read on public.moa_subscriptions for select to authenticated using (owner_id=(select auth.uid()));
create policy moa_payments_owner_read on public.moa_payments for select to authenticated using (owner_id=(select auth.uid()));
revoke all on public.moa_subscriptions,public.moa_payments,public.moa_admin_audit from anon;
revoke insert,update,delete on public.moa_subscriptions,public.moa_payments from authenticated;
revoke all on public.moa_admin_audit from authenticated;
-- Column-level guard: authenticated sessions cannot read the encrypted billing key even for their own row.
revoke select on public.moa_subscriptions from authenticated;
grant select(owner_id,plan,status,billing_cycle,current_period_end,trial_ends_at,cancel_at_period_end,created_at,updated_at) on public.moa_subscriptions to authenticated;
