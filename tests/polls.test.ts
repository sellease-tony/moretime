import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {rankSlots,voteSchema,pollSchema} from '../lib/polls/model';
import {deliver,type NoticeJob} from '../lib/notifications/providers';
test('ranked common slots and empty responses do not invent unanimity',()=>{
 assert.deepEqual(rankSlots(['2030-01-01T10:00','2030-01-01T11:00'],[{choices:['2030-01-01T11:00']},{choices:[]}]).map(s=>s.count),[1,0]);
 assert.equal(voteSchema.safeParse({id:crypto.randomUUID(),key:crypto.randomUUID(),name:'A',email:'a@example.com',choices:[],consent:true}).success,true);
 assert.equal(pollSchema.safeParse({title:'A',description:'',duration:60,meeting_mode:'online',expected_count:2,candidates:['2030-02-30T10:00']}).success,false);
});
test('poll transactions protect private responses, unanimity, revisions, cross-booking conflicts and outbox fanout',async()=>{
 const db=new PGlite();try{
 await db.exec("create schema auth;create role anon;create role authenticated;create role service_role bypassrls;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;");
 for(const f of ['202609200001_moatime.sql','202609200002_calendar_links.sql','202609230001_saved_availability.sql','202609250001_calendar_background.sql','202609250002_guest_management.sql','202609290001_reminders.sql','202609300001_travel_buffer.sql','202609300002_polls.sql'])await db.exec(await readFile('supabase/migrations/'+f,'utf8'));
 const owner=crypto.randomUUID(),poll=crypto.randomUUID(),r1=crypto.randomUUID(),r2=crypto.randomUUID(),day='2035-01-08',slot=day+'T10:00',other=day+'T11:00';
 await db.query('insert into auth.users values ($1,$2)',[owner,'host@example.com']);await db.query('insert into moa_workspaces(owner_id) values($1)',[owner]);
 await db.query("insert into moa_polls(id,owner_id,title,duration,expected_count,candidates) values($1,$2,'모임',60,2,$3)",[poll,owner,[slot,other]]);
 const vote=(id:string,email:string,choices:string[],key='a'.repeat(64))=>db.query('select moa_vote_poll($1,$2,$3,$4,$5,$6)',[poll,id,key,'참석자',email,choices]);
 const confirm=(rev:number,wrev=0,time=slot)=>db.query<{id:string}>("select moa_confirm_poll($1,$2,$3,$4,$5,'dry-run') id",[poll,owner,rev,wrev,time]);
 await vote(r1,'a@example.com',[slot]);await assert.rejects(confirm(1),/not_unanimous/);
 await assert.rejects(vote(r1,'a@example.com',[other],'b'.repeat(64)),/response_exists/);
 await assert.rejects(vote(crypto.randomUUID(),'a@example.com',[slot]),/response_exists/);
 await vote(r2,'b@example.com',[]);await assert.rejects(confirm(2),/not_unanimous/);
 await vote(r2,'b@example.com',[slot,other]);await assert.rejects(confirm(2),/stale_revision/);
 const bid=(await confirm(3)).rows[0].id;assert.equal((await confirm(3)).rows[0].id,bid);
 assert.equal((await db.query('select * from moa_bookings')).rows.length,1);
 assert.equal((await db.query('select * from moa_notification_jobs')).rows.length,3);
 const roles=(await db.query<{recipient_role:string}>('select recipient_role from moa_notification_jobs')).rows;assert.equal(roles.filter(r=>r.recipient_role.startsWith('poll:')).length,2);
 await assert.rejects(vote(r1,'a@example.com',[other]),/poll_closed/);
 const p2=crypto.randomUUID();await db.query("insert into moa_polls(id,owner_id,title,duration,expected_count,candidates) values($1,$2,'모임2',60,1,$3)",[p2,owner,[slot]]);await db.query('select moa_vote_poll($1,$2,$3,$4,$5,$6)',[p2,crypto.randomUUID(),'a'.repeat(64),'Guest','c@example.com',[slot]]);
 await assert.rejects(db.query("select moa_confirm_poll($1,$2,1,1,$3,'dry-run')",[p2,owner,slot]),/overlapping_booking/);
 await db.query("select moa_manage_booking($1,'cancel',null,null,null,'dry-run')",[bid]);
 assert.equal((await db.query<{status:string}>('select status from moa_polls where id=$1',[poll])).rows[0].status,'cancelled');
 assert.equal((await db.query("select * from moa_notification_jobs where event_type='cancelled'")).rows.length,3);
 assert.equal((await db.query<{allowed:boolean}>("select has_table_privilege('anon','moa_poll_responses','select') allowed")).rows[0].allowed,false);
 assert.equal((await db.query<{allowed:boolean}>("select has_function_privilege('anon','moa_vote_poll(uuid,uuid,text,text,text,text[])','execute') allowed")).rows[0].allowed,false);
 }finally{await db.close()}
});
test('poll email never grants a guest a link to cancel the entire group',async()=>{
 let text='';const job={id:crypto.randomUUID(),booking_id:crypto.randomUUID(),channel:'email',recipient_role:'poll:'+crypto.randomUUID(),event_type:'confirmed',mode:'live',destination:'a@example.com',payload:{pollId:crypto.randomUUID(),title:'모임',name:'A',day:'2035-01-01',time:'10:00',duration:30}} as NoticeJob;
 await deliver(job,{NOTIFICATION_MODE:'live',RESEND_API_KEY:'test',EMAIL_FROM:'test@example.com',APP_URL:'https://example.com',CALENDAR_TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,1).toString('base64')},{fetcher:(async(_u:unknown,i?:RequestInit)=>{text=JSON.parse(String(i?.body)).text;return Response.json({id:'ok'})}) as typeof fetch});
 assert.match(text,/모임/);assert.doesNotMatch(text,/booking\/manage|token=/);
});
