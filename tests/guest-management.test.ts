import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {managementToken,managementBooking,managementUrl} from '../lib/bookings/manage-token';
import {deliver,type NoticeJob} from '../lib/notifications/providers';
import {kstDay,addDays} from '../lib/availability';
const secret=Buffer.alloc(32,7).toString('base64'),id='10000000-0000-4000-8000-000000000001';
test('guest capability cannot be changed to another booking, is purpose-bound and stays in URL fragment',()=>{
 const token=managementToken(id,secret);assert.equal(managementBooking(token,secret),id);
 assert.equal(managementBooking(token.replace(id,'20000000-0000-4000-8000-000000000001'),secret),null);
 assert.equal(managementBooking(token,Buffer.alloc(32,8).toString('base64')),null);
 assert.equal(managementBooking(token+'.extra',secret),null);
 assert.equal(managementBooking('garbage',secret),null);
 const url=new URL(managementUrl(id,'https://example.com',secret));assert.equal(url.search,'');assert.ok(url.hash.startsWith('#token='));
});
test('email includes private management link only for guest confirmation/change, with previous time',async()=>{
 const env={NOTIFICATION_MODE:'live',RESEND_API_KEY:'test',EMAIL_FROM:'test@example.com',APP_URL:'https://example.com',CALENDAR_TOKEN_ENCRYPTION_KEY:secret};
 const job={id,booking_id:id,channel:'email',recipient_role:'guest',event_type:'confirmed',destination:'guest@example.com',mode:'live',payload:{id,name:'Guest',title:'Meeting',day:'2030-01-02',time:'11:00',duration:30,previousDay:'2030-01-01',previousTime:'10:00'}} as NoticeJob;
 let sent:{text:string;subject:string};
 const fetcher=async(_url:unknown,init?:RequestInit)=>{sent=JSON.parse(String(init?.body));return Response.json({id:'sent'})};
 await deliver(job,env,{fetcher:fetcher as typeof fetch});assert.match(sent!.text,/#token=/);assert.match(sent!.subject,/예약 변경/);assert.match(sent!.text,/변경 전: 2030-01-01 10:00/);
 await deliver({...job,recipient_role:'host'},env,{fetcher:fetcher as typeof fetch});assert.doesNotMatch(sent!.text,/#token=/);
 await deliver({...job,event_type:'cancelled'},env,{fetcher:fetcher as typeof fetch});assert.doesNotMatch(sent!.text,/#token=/);
});
test('reschedule is atomic, idempotent, preserves contacts and cancels without duplicate notifications',async()=>{
 const db=new PGlite();
 try{
  await db.exec("create schema auth;create role anon;create role authenticated;create role service_role bypassrls;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;");
  for(const name of ['202609200001_moatime.sql','202609200002_calendar_links.sql','202609230001_saved_availability.sql','202609250001_calendar_background.sql','202609250002_guest_management.sql'])await db.exec(await readFile('supabase/migrations/'+name,'utf8'));
  const owner='c0000000-0000-4000-8000-000000000001',next='20000000-0000-4000-8000-000000000001',other='30000000-0000-4000-8000-000000000001',day=addDays(kstDay(),3);
  await db.query('insert into auth.users values($1,$2)',[owner,'host@example.com']);
  const b={id,eventId:'event',title:'Meeting',duration:30,day,time:'10:00',name:'Guest',email:'guest@example.com',phone:'01012345678',channels:['email'],notificationConsent:true};
  const state={events:[{id:'event',title:'Meeting',duration:30,active:true,availability:{days:{[day]:['10:00','11:00','12:00']}}}],hours:Array(7).fill(true),range:['09:00','18:00']};
  await db.query('select moa_save_workspace($1,0,$2::jsonb,$3::jsonb,\'dry-run\')',[owner,JSON.stringify(state),JSON.stringify([b,{...b,id:other,time:'12:00'}])]);
  const manage=(booking:string,action:string,newId:string|null=null,time:string|null=null)=>db.query('select moa_manage_booking($1,$2,$3,$4,$5,\'dry-run\')',[booking,action,newId,day,time]);
  await assert.rejects(manage(id,'reschedule',next,'12:00'),/overlapping_booking/);
  assert.equal((await db.query<{status:string}>('select status from moa_bookings where id=$1',[id])).rows[0].status,'confirmed');
  await assert.rejects(manage(id,'reschedule',next,'13:00'),/invalid_time/);
  await manage(id,'reschedule',next,'11:00');await manage(id,'reschedule',next,'11:00');
  const rows=(await db.query<{id:string;status:string;payload:typeof b;replaced_by:string}>('select * from moa_bookings order by id')).rows;
  assert.equal(rows.find(r=>r.id===id)?.replaced_by,next);assert.equal(rows.find(r=>r.id===next)?.payload.email,b.email);
  assert.equal(rows.filter(r=>r.status==='confirmed').length,2);
  await assert.rejects(manage(id,'cancel'),/booking_changed/);
  const change=(await db.query<{payload:{previousTime:string}}> ("select payload from moa_notification_jobs where booking_id=$1 and recipient_role='guest'",[next])).rows[0];assert.equal(change.payload.previousTime,'10:00');
  await manage(next,'cancel');await manage(next,'cancel');
  assert.equal((await db.query("select * from moa_notification_jobs where booking_id=$1 and event_type='cancelled'",[next])).rows.length,2);
  await db.query("update moa_bookings set starts_at=now()-interval '1 hour',ends_at=now()+interval '1 hour' where id=$1",[other]);
  await assert.rejects(manage(other,'cancel'),/booking_started/);
  assert.equal((await db.query<{allowed:boolean}>("select has_function_privilege('anon','moa_manage_booking(uuid,text,uuid,text,text,text)','execute') allowed")).rows[0].allowed,false);
 }finally{await db.close()}
});
