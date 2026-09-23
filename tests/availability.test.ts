import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {savedSlots,monthSlots,addDays,kstDay} from '../lib/availability';
import {eventSchema,validateNewBooking} from '../lib/workspace';
const day=addDays(kstDay(),5),availability={days:{[day]:['10:00','10:30','11:00']},source:'manual' as const,updatedAt:new Date().toISOString()};
const event={id:'one',title:'상담',desc:'',duration:30 as const,color:'blue' as const,team:false,active:true,availability};
const booking={id:'a0000000-0000-4000-8000-000000000001',eventId:'one',title:'상담',duration:30 as const,day,time:'10:00',name:'Test',email:'test@example.com',phone:'',channels:[] as [],notificationConsent:false};
test('saved availability excludes cross-page overlaps, preserves boundaries and releases cancelled slots',()=>{
  const busy=[{start:day+'T10:15:00+09:00',end:day+'T11:00:00+09:00'}];
  assert.deepEqual(savedSlots(availability,day,30,busy),['11:00']);
  assert.deepEqual(savedSlots(availability,day,30,[]),['10:00','10:30','11:00']);
  assert.deepEqual(savedSlots(undefined,day,30,[]),[]);
  assert.deepEqual(monthSlots(availability,day.slice(0,7),30,busy),{[day]:['11:00']});
});
test('explicit slots override weekly template and invalid dates or midnight overflow are rejected',()=>{
  validateNewBooking(booking,{events:[event],hours:Array(7).fill(false),range:['09:00','09:30']});
  assert.throws(()=>validateNewBooking({...booking,time:'12:00'},{events:[event],hours:Array(7).fill(true),range:['00:00','23:59']}));
  assert.equal(eventSchema.safeParse({...event,availability:{...availability,days:{'2030-02-30':['10:00']}}}).success,false);
  assert.equal(eventSchema.safeParse({...event,availability:{...availability,days:{[day]:['23:45']}}}).success,false);
});
test('database atomically rejects unselected slots, cross-page conflicts and stale submissions; cancellation reopens slots',async()=>{
  const db=new PGlite();try{
    await db.exec("create schema auth;create role anon;create role authenticated;create role service_role bypassrls;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;");
    for(const file of ['202609200001_moatime.sql','202609200002_calendar_links.sql','202609230001_saved_availability.sql'])await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
    const owner='c0000000-0000-4000-8000-000000000001';await db.query('insert into auth.users values ($1,$2)',[owner,'host@example.com']);
    const state={events:[event,{...event,id:'two',duration:60,availability:{...availability,days:{[day]:['10:00','11:00']}}}],hours:Array(7).fill(false),range:['09:00','09:30']};
    const save=(rev:number,bs:unknown[])=>db.query('select moa_save_workspace($1,$2,$3::jsonb,$4::jsonb,$5)',[owner,rev,JSON.stringify(state),JSON.stringify(bs),'off']);
    await assert.rejects(save(0,[{...booking,time:'12:00'}]),/invalid_time/);
    await save(0,[booking]);
    await assert.rejects(save(0,[booking]),/stale_revision/);
    await assert.rejects(save(1,[booking,{...booking,id:'a0000000-0000-4000-8000-000000000002',eventId:'two',duration:60}]),/overlapping_booking/);
    await save(1,[]);
    await save(2,[{...booking,id:'a0000000-0000-4000-8000-000000000003'}]);
    assert.equal((await db.query("select * from moa_bookings where status='confirmed'")).rows.length,1);
  }finally{await db.close()}
});
