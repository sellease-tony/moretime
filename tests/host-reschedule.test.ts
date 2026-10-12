import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {kstDay,addDays} from '../lib/availability';
import {googleConflict,rescheduleError} from '../lib/bookings/reschedule';
import {deliver,type NoticeJob} from '../lib/notifications/providers';

const migrations=['202609200001_moatime.sql','202609200002_calendar_links.sql','202609230001_saved_availability.sql','202609250001_calendar_background.sql','202609250002_guest_management.sql','202609290001_reminders.sql','202609300001_travel_buffer.sql','202609300002_polls.sql','202610120001_host_reschedule.sql'];
const owner='c0000000-0000-4000-8000-000000000001',other='c0000000-0000-4000-8000-000000000002';
const id='10000000-0000-4000-8000-000000000001',second='10000000-0000-4000-8000-000000000002',next='20000000-0000-4000-8000-000000000001';

test('PostgreSQL: host reschedule moves a booking outside open slots, notifies both parties once and stays idempotent',async()=>{
 const db=new PGlite();
 try{
  await db.exec("create schema auth;create role anon;create role authenticated;create role service_role bypassrls;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;");
  for(const name of migrations)await db.exec(await readFile('supabase/migrations/'+name,'utf8'));
  await db.query('insert into auth.users values($1,$2),($3,$4)',[owner,'host@example.com',other,'other@example.com']);
  const day=addDays(kstDay(),3);
  const b={id,eventId:'event',title:'Meeting',duration:30,day,time:'10:00',name:'Guest',email:'guest@example.com',phone:'01012345678',channels:['email','sms'],notificationConsent:true};
  const state={events:[{id:'event',title:'Meeting',duration:30,active:true,availability:{days:{[day]:['10:00','12:00']}}}],hours:Array(7).fill(true),range:['09:00','18:00']};
  await db.query("select moa_save_workspace($1,0,$2::jsonb,$3::jsonb,'live')",[owner,JSON.stringify(state),JSON.stringify([b,{...b,id:second,time:'12:00'}])]);
  await db.query("update moa_notification_jobs set status='accepted'");
  const move=(time:string,newId=next,booking=id,who=owner,d=day)=>db.query("select moa_host_reschedule($1,$2,$3,$4,$5,'live') as id",[who,booking,newId,d,time]);

  await assert.rejects(move('12:15'),/overlapping_booking/,'another confirmed booking still blocks the time');
  await assert.rejects(move('10:00'),/same_time/);
  await assert.rejects(move('10:00',next,id,owner,addDays(kstDay(),-1)),/invalid_time/);
  await assert.rejects(move('15:00',next,id,other),/not_found/,'a host cannot move another host\'s booking');

  // 15:00 is not an open slot for this page; the host may still use it.
  assert.equal((await move('15:00')).rows[0].id,next);
  assert.equal((await move('15:00')).rows[0].id,next,'a retried request returns the same new booking');
  await assert.rejects(move('16:00'),/booking_changed/);

  const rows=(await db.query<{id:string;status:string;replaced_by:string|null;time:string}>("select id,status,replaced_by,payload->>'time' as time from moa_bookings order by id")).rows;
  assert.deepEqual(rows.map(r=>[r.id,r.status,r.replaced_by,r.time]),[[id,'cancelled',next,'10:00'],[second,'confirmed',null,'12:00'],[next,'confirmed',null,'15:00']]);
  const jobs=(await db.query<{booking_id:string;event_type:string;channel:string;recipient_role:string;prev:string|null;by:string|null}>("select booking_id,event_type,channel,recipient_role,payload->>'previousTime' as prev,payload->>'changedBy' as by from moa_notification_jobs where status='pending' order by recipient_role")).rows;
  assert.deepEqual(jobs.map(j=>[j.booking_id,j.event_type,j.channel,j.recipient_role,j.prev,j.by]),[[next,'confirmed','email','guest','10:00','host'],[next,'confirmed','email','host','10:00','host']],'one change email per party, email only, no cancellation notice');
  const payload=(await db.query<{p:Record<string,unknown>}>('select payload as p from moa_bookings where id=$1',[next])).rows[0].p;
  assert.equal('previousDay' in payload||'changedBy' in payload,false,'booking payload stays within the strict booking schema');
  assert.equal((await db.query<{n:number}>("select count(*)::int n from moa_bookings where status='confirmed' and owner_id=$1",[owner])).rows[0].n,2);

  await db.exec('set role anon');
  await assert.rejects(db.query("select moa_host_reschedule($1,$2,$3,$4,'09:00','live')",[owner,second,'30000000-0000-4000-8000-000000000001',day]),/permission denied/);
 }finally{await db.close()}
});

test('Google conflict ignores the booking\'s own calendar event and applies the travel buffer',()=>{
 const current={day:'2030-01-02',time:'10:00',duration:60};
 const own={start:'2030-01-02T01:00:00.000Z',end:'2030-01-02T02:00:00.000Z'};
 assert.equal(googleConflict([own],{day:'2030-01-02',time:'10:30',duration:60},current),false,'moving within its own slot is not a clash');
 const meeting={start:'2030-01-02T05:00:00.000Z',end:'2030-01-02T06:00:00.000Z'};
 assert.equal(googleConflict([own,meeting],{day:'2030-01-02',time:'14:30',duration:60},current),true);
 assert.equal(googleConflict([meeting],{day:'2030-01-02',time:'15:30',duration:30},current),false);
 assert.equal(googleConflict([meeting],{day:'2030-01-02',time:'15:30',duration:30},current,60),true,'offline meetings keep an hour around other events');
 assert.match(rescheduleError('ERROR: overlapping_booking'),/다른 예약/);
});

test('host-initiated change email tells the guest the host moved it',async()=>{
 const env={NOTIFICATION_MODE:'live',RESEND_API_KEY:'k',EMAIL_FROM:'from@example.com',APP_URL:'https://example.com',CALENDAR_TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64')};
 const job={id:'j',booking_id:next,channel:'email',recipient_role:'guest',event_type:'confirmed',destination:'guest@example.com',mode:'live',payload:{id:next,name:'Guest',title:'Meeting',day:'2030-01-02',time:'15:00',duration:30,previousDay:'2030-01-02',previousTime:'10:00',changedBy:'host'}} as NoticeJob;
 let sent:{text:string;subject:string}|undefined;
 const fetcher=async(_u:unknown,init?:RequestInit)=>{sent=JSON.parse(String(init?.body));return Response.json({id:'ok'})};
 await deliver(job,env,{fetcher:fetcher as typeof fetch});
 assert.match(sent!.subject,/예약 변경/);
 assert.match(sent!.text,/주최자 요청으로 예약 일정이 변경되었습니다/);
 assert.match(sent!.text,/변경 전: 2030-01-02 10:00/);
 assert.match(sent!.text,/#token=/,'the guest gets a management link for the new booking');
 await deliver({...job,recipient_role:'host'},env,{fetcher:fetcher as typeof fetch});
 assert.match(sent!.text,/Guest님의 예약이 주최자 요청으로 변경되었습니다/);
});
