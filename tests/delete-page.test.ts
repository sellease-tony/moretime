import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {workspacePatch} from '../lib/workspace';
test('page deletion is an isolated request',()=>{
 assert.equal(workspacePatch.safeParse({revision:1,deleteEventId:'one'}).success,true);
 assert.equal(workspacePatch.safeParse({revision:1,deleteEventId:'one',bookings:[]}).success,false);
});
test('removing a page preserves reservations and rejects stale page restoration and new bookings',async()=>{
 const db=new PGlite();try{
 await db.exec("create schema auth;create role anon;create role authenticated;create role service_role bypassrls;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;");
 for(const file of ['202609200001_moatime.sql','202609200002_calendar_links.sql','202609230001_saved_availability.sql'])await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 const owner='c0000000-0000-4000-8000-000000000001';await db.query('insert into auth.users values ($1,$2)',[owner,'host@example.com']);
 const day=new Date(Date.now()+86400000*10).toISOString().slice(0,10);
 const event={id:'one',title:'Meeting',active:true,duration:30,availability:{days:{[day]:['10:00','11:00']}}};
 const b={id:'a0000000-0000-4000-8000-000000000001',eventId:'one',title:'Meeting',duration:30,day,time:'10:00',name:'Guest',email:'guest@example.com',channels:[]};
 const save=(revision:number,events:unknown[],bookings:unknown[])=>db.query('select moa_save_workspace($1,$2,$3::jsonb,$4::jsonb,$5)',[owner,revision,JSON.stringify({events}),JSON.stringify(bookings),'off']);
 await save(0,[event],[b]);await save(1,[],[b]);
 assert.equal((await db.query<{status:string}>('select status from moa_bookings')).rows[0].status,'confirmed');
 assert.deepEqual((await db.query<{data:{events:unknown[]}}>('select data from moa_workspaces')).rows[0].data.events,[]);
 await assert.rejects(save(1,[event],[b]),/stale_revision/);
 await assert.rejects(save(2,[],[b,{...b,id:'a0000000-0000-4000-8000-000000000002',time:'11:00'}]),/invalid_event/);
 }finally{await db.close()}
});
