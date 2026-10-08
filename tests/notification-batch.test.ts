import test from 'node:test';
import assert from 'node:assert/strict';
import type {SupabaseClient} from '@supabase/supabase-js';
import {processClaimed} from '../lib/notifications/process';
import type {NoticeJob,Delivery} from '../lib/notifications/providers';

type Update={table:string;values:Record<string,unknown>;filters:Record<string,unknown>};
// Minimal chainable stand-in for the Supabase query builder.
function fakeDb(bookings:Record<string,{status:string;starts_at:string}|'error'>,failUpdateFor:string[]=[]){
  const updates:Update[]=[];
  const db={from(table:string){
    let values:Record<string,unknown>|null=null;const filters:Record<string,unknown>={};
    const q={
      select(){return q},
      update(v:Record<string,unknown>){values=v;return q},
      eq(k:string,v:unknown){filters[k]=v;return q},
      async single(){const b=bookings[filters.id as string];return b==='error'||!b?{data:null,error:{message:'down'}}:{data:b,error:null}},
      async maybeSingle(){return {data:null,error:null}},
      then(resolve:(r:{error:unknown})=>void){updates.push({table,values:values!,filters:{...filters}});resolve({error:failUpdateFor.includes(filters.id as string)?{message:'down'}:null})}
    };
    return q;
  }};
  return {db:db as unknown as SupabaseClient,updates};
}
const job=(id:string,booking:string,channel:NoticeJob['channel']='email'):NoticeJob=>({id,owner_id:'owner',booking_id:booking,channel,recipient_role:'guest',event_type:'confirmed',destination:'01000000000',payload:{} as NoticeJob['payload'],mode:'live',attempts:1,lease_token:'lease-'+id,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+3600_000).toISOString()});

test('a failed pre-send check releases only that job and the rest of the batch still completes',async()=>{
  const {db,updates}=fakeDb({b1:'error',b2:{status:'confirmed',starts_at:'2030-01-01T01:00:00Z'}});
  const sent:string[]=[];
  const send=async(j:NoticeJob):Promise<Delivery>=>{sent.push(j.id);return {status:'accepted',providerId:'p'}};
  const results=await processClaimed(db,[job('j1','b1'),job('j2','b2')],send);
  assert.deepEqual(sent,['j2'],'the job whose check failed is never sent');
  assert.deepEqual(results.map(r=>[r.id,r.status]),[['j1','released'],['j2','accepted']]);
  const released=updates.find(u=>u.filters.id==='j1')!;
  assert.equal(released.values.status,'pending','a job that was never sent goes back to the queue instead of expiring');
  assert.equal(released.filters.lease_token,'lease-j1');
  assert.equal(released.filters.status,'processing');
});

test('a result that cannot be recorded is reported without failing the other jobs',async()=>{
  const ok={status:'confirmed',starts_at:'2030-01-01T01:00:00Z'};
  const {db}=fakeDb({b1:ok,b2:ok},['j1']);
  const results=await processClaimed(db,[job('j1','b1','email'),job('j2','b2','email')],async()=>({status:'accepted',providerId:'p'}));
  assert.deepEqual(results.map(r=>[r.id,r.status]),[['j1','unrecorded'],['j2','accepted']]);
});

test('a cancelled booking supersedes its claimed confirmation without contacting providers',async()=>{
  const {db,updates}=fakeDb({b1:{status:'cancelled',starts_at:'2030-01-01T01:00:00Z'}});
  let called=false;
  const results=await processClaimed(db,[job('j1','b1')],async()=>{called=true;return {status:'accepted'}});
  assert.equal(called,false);
  assert.equal(results[0].status,'superseded');
  assert.equal(updates[0].values.status,'superseded');
});

test('SMS and Kakao jobs left on older bookings are blocked without contacting providers',async()=>{
  const ok={status:'confirmed',starts_at:'2030-01-01T01:00:00Z'};
  const {db,updates}=fakeDb({b1:ok,b2:ok,b3:ok});
  const sent:string[]=[];
  const results=await processClaimed(db,[job('j1','b1','sms'),job('j2','b2','kakao'),job('j3','b3','email')],async j=>{sent.push(j.id);return {status:'accepted'}});
  assert.deepEqual(sent,['j3']);
  assert.deepEqual(results.map(r=>r.status),['blocked','blocked','accepted']);
  assert.equal(updates.find(u=>u.filters.id==='j1')!.values.status,'blocked');
});
