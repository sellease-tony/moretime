import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {defaultReminders,reminderCanSend} from '../lib/notifications/reminders';
import {deliver,type NoticeJob} from '../lib/notifications/providers';

test('reminder dispatch rechecks cancellation, start time, expiry and settings',()=>{
 const now=Date.now(),job={event_type:'reminder_1h',recipient_role:'guest',expires_at:new Date(now+1000).toISOString()},booking={status:'confirmed',starts_at:new Date(now+3600000).toISOString()};
 assert.equal(reminderCanSend(job,booking,defaultReminders,now),true);
 for(const b of [{...booking,status:'cancelled'},{...booking,starts_at:new Date(now).toISOString()}])assert.equal(reminderCanSend(job,b,defaultReminders,now),false);
 assert.equal(reminderCanSend({...job,expires_at:new Date(now).toISOString()},booking,defaultReminders,now),false);
 assert.equal(reminderCanSend(job,booking,{...defaultReminders,guest:false},now),false);
 assert.equal(reminderCanSend(job,booking,{...defaultReminders,reminder_1h:false},now),false);
});

test('reminder email has correct subject and private guest management link with stable retry key',async()=>{
 const job={id:'job',booking_id:'10000000-0000-4000-8000-000000000001',channel:'email',recipient_role:'guest',event_type:'reminder_1h',mode:'live',destination:'guest@example.com',payload:{name:'Guest',title:'Meeting',meetingTitle:'ABC × 셀리즈 미팅',day:'2030-01-01',time:'10:00',duration:30,previousDay:'2029-12-31'}} as NoticeJob;
 const env={NOTIFICATION_MODE:'live',RESEND_API_KEY:'test',EMAIL_FROM:'test@example.com',APP_URL:'https://example.com',CALENDAR_TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64')};
 const sent:Array<{text:string;subject:string}>=[],keys:string[]=[];
 const fetcher=(async(_u:unknown,init?:RequestInit)=>{sent.push(JSON.parse(String(init?.body)));keys.push(new Headers(init?.headers).get('Idempotency-Key')!);return Response.json({id:'accepted'})}) as typeof fetch;
 await deliver(job,env,{fetcher});await deliver(job,env,{fetcher});await deliver({...job,recipient_role:'host',event_type:'reminder_24h'},env,{fetcher});
 assert.match(sent[0].subject,/ABC × 셀리즈 미팅/);assert.match(sent[0].text,/ABC × 셀리즈 미팅/);assert.match(sent[0].subject,/1시간 전/);assert.match(sent[0].text,/#token=/);assert.doesNotMatch(sent[0].text,/변경 전/);assert.equal(keys[0],keys[1]);assert.match(sent[2].subject,/하루 전/);assert.doesNotMatch(sent[2].text,/#token=/);
});

test('scheduler enqueues only due eligible reminders once, respects mode and recipient preferences',async()=>{
 const db=new PGlite();
 try{
  await db.exec("create schema auth;create role anon;create role authenticated;create role service_role bypassrls;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;");
  for(const name of ['202609200001_moatime.sql','202609290001_reminders.sql'])await db.exec(await readFile('supabase/migrations/'+name,'utf8'));
  const owner='c0000000-0000-4000-8000-000000000001';await db.query('insert into auth.users values($1,$2)',[owner,'host@example.com']);
  const seed=async(n:number,start:string,created='48 hours',status='confirmed',mode='live')=>{
   const id=`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
   const payload=JSON.stringify({id,email:'guest@example.com',channels:['email']});
   await db.query("insert into moa_bookings(id,owner_id,payload,starts_at,ends_at,status,created_at) values($1,$2,$3,now()+$4::interval,now()+$4::interval+interval '30 minutes',$5,now()-$6::interval)",[id,owner,payload,start,status,created]);
   await db.query("select moa_enqueue($1,$2,'confirmed',$3)",[owner,payload,mode]);return id;
  };
  await seed(1,'23 hours 50 minutes');await seed(2,'55 minutes');
  await seed(3,'25 hours');await seed(4,'40 minutes');await seed(5,'55 minutes','2 minutes');await seed(6,'55 minutes','48 hours','cancelled');await seed(7,'55 minutes','48 hours','confirmed','off');await seed(8,'55 minutes','48 hours','confirmed','dry-run');
  const enqueue=async(mode='live')=>(await db.query<{n:number}>('select moa_enqueue_reminders($1) n',[mode])).rows[0].n;
  assert.equal(await enqueue('off'),0);assert.equal(await enqueue(),6);assert.equal(await enqueue(),0);
  const rows=(await db.query<{event_type:string;mode:string;expires_at:Date}>("select event_type,mode,expires_at from moa_notification_jobs where event_type like 'reminder_%'")).rows;
  assert.equal(rows.filter(r=>r.mode==='dry-run').length,2);assert.equal(rows.filter(r=>r.event_type==='reminder_24h').length,2);
  assert.ok(rows.every(r=>new Date(r.expires_at).getTime()>Date.now()));
  await db.query('insert into moa_reminder_settings(owner_id,guest,reminder_24h) values($1,false,false)',[owner]);
  await seed(9,'55 minutes');await seed(10,'23 hours 50 minutes');assert.equal(await enqueue(),1);
  assert.equal((await db.query<{allowed:boolean}>("select has_function_privilege('anon','moa_enqueue_reminders(text)','execute') allowed")).rows[0].allowed,false);
 }finally{await db.close()}
});
