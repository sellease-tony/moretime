import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {effectivePlan,type Subscription} from '../lib/billing/plan';

const now=new Date('2026-11-01T00:00:00Z'),later='2026-12-01T00:00:00Z',earlier='2026-10-01T00:00:00Z';
const sub=(o:Partial<Subscription>):Subscription=>({owner_id:'u',plan:'pro',status:'active',billing_cycle:'monthly',current_period_end:later,trial_ends_at:null,cancel_at_period_end:false,...o});

test('during the beta every host gets Pro, with or without a subscription',()=>{
 assert.equal(effectivePlan(null,now,false),'pro');
 assert.equal(effectivePlan(sub({status:'canceled',plan:'free'}),now,false),'pro');
});

test('once billing opens, Pro needs a live paid period, trial or grant',()=>{
 assert.equal(effectivePlan(null,now,true),'free');
 assert.equal(effectivePlan(sub({}),now,true),'pro');
 assert.equal(effectivePlan(sub({current_period_end:earlier}),now,true),'free');
 assert.equal(effectivePlan(sub({plan:'free'}),now,true),'free');
 assert.equal(effectivePlan(sub({status:'trialing',current_period_end:null,trial_ends_at:later}),now,true),'pro');
 assert.equal(effectivePlan(sub({status:'trialing',current_period_end:null,trial_ends_at:earlier}),now,true),'free');
 assert.equal(effectivePlan(sub({status:'comped',current_period_end:null}),now,true),'pro');
 assert.equal(effectivePlan(sub({status:'comped',current_period_end:earlier}),now,true),'free');
 assert.equal(effectivePlan(sub({status:'canceled'}),now,true),'free');
});

test('a failed renewal keeps Pro for a three-day grace period only',()=>{
 assert.equal(effectivePlan(sub({status:'past_due',current_period_end:'2026-10-30T00:00:00Z'}),now,true),'pro');
 assert.equal(effectivePlan(sub({status:'past_due',current_period_end:'2026-10-28T00:00:00Z'}),now,true),'free');
});

test('hosts can read their own plan but never the billing key, and cannot write subscriptions',async()=>{
 const db=new PGlite();
 await db.exec("create schema auth;create role anon;create role authenticated;create role service_role bypassrls;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select '00000000-0000-4000-8000-000000000001'::uuid$$;");
 await db.exec(await readFile('supabase/migrations/202610230001_subscriptions.sql','utf8'));
 await db.exec("insert into auth.users values ('00000000-0000-4000-8000-000000000001','a@x.io'),('00000000-0000-4000-8000-000000000002','b@x.io');insert into moa_subscriptions(owner_id,plan,status,billing_key_enc) values ('00000000-0000-4000-8000-000000000001','pro','active','secret'),('00000000-0000-4000-8000-000000000002','pro','active','secret2');");
 await assert.rejects(db.exec("insert into moa_subscriptions(owner_id,status) values ('00000000-0000-4000-8000-000000000002','bogus')"));
 await assert.rejects(db.exec("insert into moa_payments(owner_id,order_id,amount,refunded_amount,status) values ('00000000-0000-4000-8000-000000000001','o1',5000,6000,'paid')"));
 await db.exec('grant usage on schema public to authenticated;set role authenticated;');
 const own=await db.query<{owner_id:string;plan:string}>('select owner_id,plan from moa_subscriptions');
 assert.deepEqual(own.rows.map(r=>r.owner_id),['00000000-0000-4000-8000-000000000001']);
 await assert.rejects(db.query('select billing_key_enc from moa_subscriptions'));
 await assert.rejects(db.exec("update moa_subscriptions set plan='free'"));
 await assert.rejects(db.query('select * from moa_admin_audit'));
});
