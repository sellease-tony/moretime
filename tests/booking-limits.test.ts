import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {bookableSlots,dayCounts,monthSlots,nextAvailableDay,savedSlots,kstDay,addDays,type Availability} from '../lib/availability';

const now=new Date('2030-01-01T09:00:00+09:00');
const a:Availability={source:'manual',updatedAt:'x',days:{'2030-01-01':['10:00','12:00','15:00'],'2030-01-02':['10:00','11:00']}};

test('minimum notice hides slots that start too soon, without touching what calendar sync stores',()=>{
 const rules={...a,minNoticeHours:3};
 assert.deepEqual(bookableSlots(rules,'2030-01-01',60,[],{},now),['12:00','15:00'],'12:00 is exactly 3 hours away and still bookable');
 assert.deepEqual(savedSlots(rules,'2030-01-01',60,[],now),['10:00','12:00','15:00'],'saved slots ignore guest rules');
 assert.deepEqual(bookableSlots(a,'2030-01-01',60,[],{},now),['10:00','12:00','15:00'],'unset means no limit');
});

test('a full day offers no slots and the next open day skips it',()=>{
 const rules={...a,dailyLimit:2};
 const taken=dayCounts([{eventId:'p',day:'2030-01-01'},{eventId:'p',day:'2030-01-01'},{eventId:'other',day:'2030-01-02'}],'p');
 assert.deepEqual(taken,{'2030-01-01':2},'only this page counts');
 assert.deepEqual(monthSlots(rules,'2030-01',60,[],now,taken),{'2030-01-01':[],'2030-01-02':['10:00','11:00']});
 assert.equal(nextAvailableDay(rules,'2030-01-01','2030-01-31',60,[],now,taken),'2030-01-02');
 assert.deepEqual(bookableSlots({...a,dailyLimit:0},'2030-01-01',60,[],taken,now),['10:00','12:00','15:00']);
});

const migrations=['202609200001_moatime.sql','202609200002_calendar_links.sql','202609230001_saved_availability.sql','202609250001_calendar_background.sql','202609250002_guest_management.sql','202609290001_reminders.sql','202609300001_travel_buffer.sql','202609300002_polls.sql','202610120001_host_reschedule.sql','202610130001_meet_url.sql','202610130002_booking_limits.sql'];
test('PostgreSQL: the database enforces notice and daily limit for guests; a host reschedule may override them',async()=>{
 const db=new PGlite();
 try{
  await db.exec("create schema auth;create role anon;create role authenticated;create role service_role bypassrls;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;");
  for(const name of migrations)await db.exec(await readFile('supabase/migrations/'+name,'utf8'));
  const owner='c0000000-0000-4000-8000-000000000001';await db.query('insert into auth.users values($1,$2)',[owner,'host@example.com']);
  const day=addDays(kstDay(),3),soon=kstDay();
  const times=['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00'];
  const state={events:[{id:'p',title:'Meeting',duration:30,active:true,availability:{days:{[day]:times,[soon]:times},minNoticeHours:24,dailyLimit:2}}],hours:Array(7).fill(true),range:['00:00','23:59']};
  const b=(id:string,time:string,d=day)=>({id,eventId:'p',title:'Meeting',duration:30,day:d,time,name:'Guest',email:'g@example.com',phone:'',channels:['email'],notificationConsent:true});
  let revision=0;
  const save=async(bookings:unknown[])=>{const r=await db.query<{revision:number}>("select moa_save_workspace($1,$2,$3::jsonb,$4::jsonb,'dry-run') as revision",[owner,revision,JSON.stringify(state),JSON.stringify(bookings)]);revision=r.rows[0].revision;};
  const id=(n:number)=>`10000000-0000-4000-8000-00000000000${n}`;
  await save([b(id(1),'10:00'),b(id(2),'11:00')]);
  await assert.rejects(save([b(id(1),'10:00'),b(id(2),'11:00'),b(id(3),'12:00')]),/daily_limit/,'a third guest booking on a full day is refused');
  const later=times.find(t=>Date.parse(`${soon}T${t}:00+09:00`)>Date.now()+3600e3);
  if(later)await assert.rejects(save([b(id(1),'10:00'),b(id(2),'11:00'),b(id(4),later,soon)]),/min_notice/,'a booking inside the 24h notice is refused');
  // The host agreed a time by phone: moving booking 1 onto a full day is allowed.
  const other=addDays(day,1);state.events[0].availability.days[other]=times;await save([b(id(1),'10:00'),b(id(2),'11:00'),b(id(5),'10:00',other),b(id(6),'11:00',other)]);
  const moved=await db.query<{id:string}>("select moa_host_reschedule($1,$2,$3,$4,'15:00','dry-run') as id",[owner,id(1),'20000000-0000-4000-8000-000000000001',other]);
  assert.equal(moved.rows[0].id,'20000000-0000-4000-8000-000000000001');
  assert.equal((await db.query<{n:number}>("select count(*)::int n from moa_bookings where status='confirmed' and payload->>'day'=$1",[other])).rows[0].n,3,'host override exceeds the limit on purpose');
 }finally{await db.close()}
});
