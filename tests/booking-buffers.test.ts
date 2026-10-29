import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {savedSlots,bufferFields,kstDay,addDays,type Availability} from '../lib/availability';
import {overlaps} from '../lib/calendar/google';
import {bookingSchema,eventSchema} from '../lib/workspace';

const now=new Date('2030-01-01T00:00:00+09:00');
const a:Availability={source:'manual',updatedAt:'x',days:{'2030-01-01':['09:00','10:00','11:00','12:00','13:00']}};
const meeting={start:'2030-01-01T11:00:00+09:00',end:'2030-01-01T12:00:00+09:00'};

test('page buffers keep time free before and after calendar events',()=>{
 assert.deepEqual(savedSlots(a,'2030-01-01',60,[meeting],now),['09:00','10:00','12:00','13:00'],'no buffer: back-to-back is fine');
 assert.deepEqual(savedSlots({...a,bufferAfter:15},'2030-01-01',60,[meeting],now),['09:00','12:00','13:00'],'10:00 would end right when 11:00 starts');
 assert.deepEqual(savedSlots({...a,bufferBefore:15},'2030-01-01',60,[meeting],now),['09:00','10:00','13:00'],'12:00 would start right after 11:00 ends');
});

test('another booking’s own buffers count too, and the larger gap wins on each side',()=>{
 const booked={...meeting,bufferBefore:30,bufferAfter:0};
 assert.equal(overlaps('2030-01-01T10:00:00+09:00','2030-01-01T11:00:00+09:00',[booked]),true,'their 30-minute lead buffer blocks a meeting ending at 11:00');
 assert.equal(overlaps('2030-01-01T12:00:00+09:00','2030-01-01T13:00:00+09:00',[booked]),false,'nothing after them');
 assert.equal(overlaps('2030-01-01T12:10:00+09:00','2030-01-01T13:00:00+09:00',[booked],0,{before:15}),true,'our own 15-minute lead buffer');
 assert.equal(overlaps('2030-01-01T12:20:00+09:00','2030-01-01T13:00:00+09:00',[booked],0,{before:15}),false);
 assert.equal(overlaps('2030-01-01T12:30:00+09:00','2030-01-01T13:00:00+09:00',[{...meeting,bufferMinutes:60}],0,{before:15}),true,'offline travel time still applies');
});

test('buffers are validated and copied onto bookings only when set',()=>{
 assert.deepEqual(bufferFields({...a,bufferBefore:10,bufferAfter:0}),{bufferBefore:10});
 assert.deepEqual(bufferFields(undefined),{});
 const event={id:'e',title:'상담',desc:'',duration:30,color:'blue',team:false,active:true,availability:{...a,source:'manual',updatedAt:new Date().toISOString(),bufferBefore:15,bufferAfter:30}};
 assert.equal(eventSchema.safeParse(event).success,true);
 assert.equal(eventSchema.safeParse({...event,availability:{...event.availability,bufferAfter:121}}).success,false);
 const booking={id:'a0000000-0000-4000-8000-000000000001',eventId:'e',title:'상담',duration:30,day:'2030-01-01',time:'10:00',name:'예약자',email:'g@x.io',bufferBefore:15};
 assert.equal(bookingSchema.safeParse(booking).success,true);
});

const migrations=['202609200001_moatime.sql','202609200002_calendar_links.sql','202609230001_saved_availability.sql','202609250001_calendar_background.sql','202609250002_guest_management.sql','202609290001_reminders.sql','202609300001_travel_buffer.sql','202609300002_polls.sql','202610120001_host_reschedule.sql','202610130001_meet_url.sql','202610130002_booking_limits.sql','202610300001_booking_buffers.sql'];
test('PostgreSQL: buffers stored on bookings block too-close guest bookings across pages; host reschedules may override',async()=>{
 const db=new PGlite();
 try{
  await db.exec("create schema auth;create role anon;create role authenticated;create role service_role bypassrls;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;");
  for(const name of migrations)await db.exec(await readFile('supabase/migrations/'+name,'utf8'));
  const owner='c0000000-0000-4000-8000-000000000001';await db.query('insert into auth.users values($1,$2)',[owner,'host@example.com']);
  const day=addDays(kstDay(),3),times=['09:00','10:00','10:30','11:00','11:30','12:00','13:00','14:00'];
  const state={events:[{id:'p',title:'Meeting',duration:30,active:true,availability:{days:{[day]:times},bufferBefore:0,bufferAfter:30}},{id:'q',title:'Other',duration:30,active:true,availability:{days:{[day]:times}}}],hours:Array(7).fill(true),range:['00:00','23:59']};
  const b=(id:string,time:string,eventId='p',extra={})=>({id,eventId,title:eventId==='p'?'Meeting':'Other',duration:30,day,time,name:'Guest',email:'g@example.com',phone:'',channels:['email'],notificationConsent:true,...extra});
  let revision=0;
  const save=async(bookings:unknown[])=>{const r=await db.query<{revision:number}>("select moa_save_workspace($1,$2,$3::jsonb,$4::jsonb,'dry-run') as revision",[owner,revision,JSON.stringify(state),JSON.stringify(bookings)]);revision=r.rows[0].revision;};
  const id=(n:number)=>`10000000-0000-4000-8000-00000000000${n}`;
  const first=b(id(1),'10:00','p',{bufferAfter:30});
  await save([first]);
  await assert.rejects(save([first,b(id(2),'10:30','q')]),/overlapping_booking/,'10:30 on another page is inside the 30-minute trailing buffer');
  await save([first,b(id(3),'11:00','q')]);
  await assert.rejects(save([first,b(id(3),'11:00','q'),b(id(4),'09:00','q',{bufferAfter:45})]),/overlapping_booking/,'the new booking’s own 45-minute trailing buffer runs past 10:00');
  await save([first,b(id(3),'11:00','q'),b(id(5),'12:00','q')]);
  // Host agreed with the guest: moving booking 5 right after booking 3 is allowed.
  const moved=await db.query<{id:string}>("select moa_host_reschedule($1,$2,$3,$4,'11:30','dry-run') as id",[owner,id(5),'20000000-0000-4000-8000-000000000001',day]);
  assert.equal(moved.rows[0].id,'20000000-0000-4000-8000-000000000001');
 }finally{await db.close()}
});
