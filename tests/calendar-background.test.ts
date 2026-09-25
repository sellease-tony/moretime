import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {channelTokenHash,validChannel} from '../lib/calendar/channel-auth';

test('webhook validates token, resource, expiration and early sync',()=>{
 const h=new Headers({'x-goog-channel-token':'secret','x-goog-resource-id':'resource','x-goog-resource-state':'exists'});
 const c={token_hash:channelTokenHash('secret'),resource_id:'resource',expires_at:'2030-01-02T00:00:00Z'},now=Date.parse('2030-01-01');
 assert.equal(validChannel(h,c,now),true);
 assert.equal(validChannel(h,{...c,resource_id:'other'},now),false);
 assert.equal(validChannel(h,{...c,expires_at:'2020-01-01'},now),false);
 assert.equal(validChannel(h,{...c,token_hash:channelTokenHash('wrong')},now),false);
 h.set('x-goog-resource-state','sync');assert.equal(validChannel(h,{...c,resource_id:null},now),true);
 h.set('x-goog-resource-state','bogus');assert.equal(validChannel(h,c,now),false);
});

test('durable queue preserves concurrent notifications, recovers leases and restricts access',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create role anon;create role authenticated;create role service_role;create table moa_google_connections(owner_id uuid primary key);');
  await db.exec(readFileSync(new URL('../supabase/migrations/202609250001_calendar_background.sql',import.meta.url),'utf8'));
  const owner='10000000-0000-4000-8000-000000000001';
  await db.query('insert into moa_google_connections values($1)',[owner]);
  const claim=async()=>(await db.query<{lease_id:string;version:number}>('select * from moa_claim_calendar()')).rows[0];
  const first=await claim();assert.ok(first);assert.equal(await claim(),undefined);
  await db.query('select moa_enqueue_calendar($1)',[owner]);
  await db.query('select moa_finish_calendar($1,$2,$3,true)',[owner,first.lease_id,first.version]);
  const next=await claim();assert.ok(next,'notification during processing remains due');
  await db.query('select moa_finish_calendar($1,$2,$3,true)',[owner,first.lease_id,first.version]);
  assert.equal(await claim(),undefined,'stale worker cannot release newer lease');
  await db.query("update moa_calendar_jobs set lease_until=now()-interval '1 second'");
  const recovered=await claim();assert.ok(recovered);
  await db.query('select moa_finish_calendar($1,$2,$3,true)',[owner,recovered.lease_id,recovered.version]);
  assert.equal(await claim(),undefined,'successful job is scheduled later');
  const grants=await db.query<{allowed:boolean}>("select has_function_privilege('anon','moa_claim_calendar()','execute') as allowed");
  assert.equal(grants.rows[0].allowed,false);
 }finally{await db.close()}
});
