import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {clientIp,rateBucket} from '../lib/rate-limit/key';

test('client IP prefers the platform header and buckets never contain raw values',()=>{
  assert.equal(clientIp(new Headers({'x-real-ip':'203.0.113.7','x-forwarded-for':'198.51.100.1, 10.0.0.1'})),'203.0.113.7');
  assert.equal(clientIp(new Headers({'x-forwarded-for':' 198.51.100.1 , 10.0.0.1'})),'198.51.100.1');
  assert.equal(clientIp(new Headers()),'unknown');
  const bucket=rateBucket('book-ip','203.0.113.7');
  assert.match(bucket,/^book-ip:[a-f0-9]{32}$/);
  assert.ok(!bucket.includes('203.0.113.7'));
  assert.notEqual(rateBucket('vote-ip','203.0.113.7').split(':')[1],bucket.split(':')[1],'scopes do not share counters');
});

test('PostgreSQL: fixed-window limits count every bucket and stay service-role only',async()=>{
  const db=new PGlite();
  try{
    await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
    await db.exec(await readFile('supabase/migrations/202610080002_rate_limits.sql','utf8'));
    const hit=(buckets:string[],limits:number[])=>db.query<{ok:boolean}>('select public.moa_hit_rate_limits($1,$2,3600) as ok',[buckets,limits]).then(r=>r.rows[0].ok);
    for(let i=0;i<3;i++)assert.equal(await hit(['ip:a','link:x'],[3,10]),true);
    assert.equal(await hit(['ip:a','link:x'],[3,10]),false,'fourth request from the same visitor is refused');
    assert.equal(await hit(['ip:b','link:x'],[3,10]),true,'another visitor on the same link is still allowed');
    assert.equal(await hit(['ip:c','link:x'],[3,4]),false,'the per-link cap applies across visitors');
    const {rows}=await db.query<{hits:number}>("select hits from public.moa_rate_limits where bucket='link:x'");
    assert.equal(rows[0].hits,6);
    await assert.rejects(hit(['ip:a'],[1,2]),/invalid_rate_limit/);
    await db.exec('set role anon');
    await assert.rejects(db.query("select public.moa_hit_rate_limits(array['x'],array[1],60)"),/permission denied/);
    await assert.rejects(db.query('select * from public.moa_rate_limits'),/permission denied/);
  }finally{await db.close()}
});
