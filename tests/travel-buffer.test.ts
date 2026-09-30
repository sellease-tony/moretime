import {test} from 'node:test';
import assert from 'node:assert/strict';
import {availableSlots} from '../lib/calendar/google';
import {savedSlots} from '../lib/availability';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
const day='2035-01-08',now=new Date('2035-01-01'),busy=[{start:day+'T12:00:00+09:00',end:day+'T13:00:00+09:00'}];
test('offline leaves one hour on either side with exact boundaries; online preserves adjacent slots',()=>{
 assert.deepEqual(availableSlots(day,60,Array(7).fill(true),['10:00','15:00'],busy,now,60),['10:00','14:00']);
 assert.deepEqual(availableSlots(day,60,Array(7).fill(true),['10:00','15:00'],busy,now),['10:00','11:00','13:00','14:00']);
 const a={days:{[day]:['10:00','11:00','13:00','14:00']},source:'manual' as const,updatedAt:now.toISOString()};
 assert.deepEqual(savedSlots(a,day,60,busy.map(b=>({...b,bufferMinutes:60})),now),['10:00','14:00']);
 assert.deepEqual(savedSlots({...a,meetingMode:'offline'},day,60,busy.map(b=>({...b,bufferMinutes:60})),now),['10:00','14:00']);
 const midnight=[{start:'2035-01-07T23:30:00+09:00',end:day+'T00:30:00+09:00'}];
 assert.deepEqual(savedSlots({...a,meetingMode:'offline',days:{[day]:['01:00','02:00']}},day,60,midnight,now),['02:00']);
});
test('database rejects travel conflicts across pages in either direction and releases them on cancellation',async()=>{
 const db=new PGlite();try{
 await db.exec("create schema auth;create role anon;create role authenticated;create role service_role bypassrls;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;");
 for(const f of ['202609200001_moatime.sql','202609200002_calendar_links.sql','202609300001_travel_buffer.sql'])await db.exec(await readFile('supabase/migrations/'+f,'utf8'));
 const owner='c0000000-0000-4000-8000-000000000001';await db.query('insert into auth.users values ($1,$2)',[owner,'host@example.com']);
 const base={title:'Meeting',duration:60,active:true,availability:{days:{[day]:['10:00','11:00','12:00','13:00']}}};
 const state={events:[{...base,id:'offline',availability:{...base.availability,meetingMode:'offline'}},{...base,id:'online'}]};
 const b={id:'a0000000-0000-4000-8000-000000000001',eventId:'offline',title:'Meeting',duration:60,day,time:'11:00',name:'Guest',email:'guest@example.com',channels:[],meetingMode:'offline'};
 const c={...b,id:'a0000000-0000-4000-8000-000000000002',eventId:'online',meetingMode:'online',time:'12:00'};
 const save=(rev:number,bookings:unknown[])=>db.query('select moa_save_workspace($1,$2,$3,$4,$5)',[owner,rev,JSON.stringify(state),JSON.stringify(bookings),'off']);
 await save(0,[b]);await assert.rejects(save(1,[b,c]),/overlapping_booking/);await assert.rejects(save(1,[b,{...c,time:'10:00'}]),/overlapping_booking/);
 await save(1,[b,{...c,time:'13:00'}]);await save(2,[{...c,time:'13:00'}]);
 await save(3,[{...c,time:'13:00'},{...b,id:'a0000000-0000-4000-8000-000000000003',time:'11:00'}]);
 await assert.rejects(save(4,[{...c,time:'13:00'},{...b,id:'a0000000-0000-4000-8000-000000000004',time:'12:00'}]),/overlapping_booking/);
 }finally{await db.close()}
});
