import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {availableSlots,queryGoogleBusy,overlaps} from '../lib/calendar/google';
import {encryptToken,decryptToken} from '../lib/calendar/crypto';
import {deliver,solapiMessage,type NoticeJob} from '../lib/notifications/providers';
import {bookingSchema} from '../lib/workspace';

const state={events:[{id:'coffee',title:'상담',desc:'',duration:30,color:'blue',team:false,active:true}],hours:[false,true,true,true,true,true,false],range:['09:00','18:00']};
const date=new Date(Date.now()+4*86400000);while([0,6].includes(date.getUTCDay()))date.setUTCDate(date.getUTCDate()+1);
const day=date.toISOString().slice(0,10);
const booking={id:'a0000000-0000-4000-8000-000000000001',eventId:'coffee',title:'상담',duration:30 as const,day,time:'10:00',name:'예약자',email:'guest@example.com',phone:'01012345678',channels:['email','sms','kakao'] as ('email'|'sms'|'kakao')[],notificationConsent:true};
const job:NoticeJob={id:'b0000000-0000-4000-8000-000000000001',owner_id:'c0000000-0000-4000-8000-000000000001',booking_id:booking.id,channel:'email',recipient_role:'guest',event_type:'confirmed',destination:booking.email,payload:booking,mode:'live',attempts:1,lease_token:'lease',created_at:new Date().toISOString(),expires_at:new Date(Date.now()+23*3600000).toISOString()};
const env={NOTIFICATION_MODE:'live',RESEND_API_KEY:'fake-test-key',EMAIL_FROM:'Calendar <calendar@example.com>',SOLAPI_API_KEY:'test',SOLAPI_API_SECRET:'test',SOLAPI_FROM:'0212345678',KAKAO_PF_ID:'test-channel',KAKAO_TEMPLATE_CONFIRMED:'confirmed',KAKAO_TEMPLATE_CANCELLED:'cancelled'};

test('calendar overlaps use half-open boundaries and exclude all-day events',()=>{
  assert.equal(overlaps('2030-01-01T10:00:00+09:00','2030-01-01T10:30:00+09:00',[{start:'2030-01-01T10:30:00+09:00',end:'2030-01-01T11:00:00+09:00'}]),false);
  const slots=availableSlots(day,30,state.hours,state.range,[{start:day+'T10:15:00+09:00',end:day+'T11:00:00+09:00'}],new Date('2020-01-01'));
  assert(!slots.includes('10:00'));assert(!slots.includes('10:30'));assert(slots.includes('11:00'));
  assert.deepEqual(availableSlots(day,30,state.hours,state.range,[{start:day+'T00:00:00+09:00',end:day+'T23:59:59+09:00'}],new Date('2020-01-01')),[]);
});
test('Google queries selected calendars with pagination and fails closed on partial errors',async()=>{
  let n=0;
  const fake=async()=>{n++;return Response.json(n===1?{items:[{id:'primary',primary:true}],nextPageToken:'more'}:n===2?{items:[{id:'secondary',selected:true}]}:{calendars:{primary:{busy:[]},secondary:{errors:[{reason:'notFound'}]}}})};
  await assert.rejects(queryGoogleBusy('test',day+'T00:00:00Z',day+'T23:00:00Z',fake as typeof fetch),/일부 캘린더/);assert.equal(n,3);
});
test('Calendar tokens are encrypted and tampering is rejected',()=>{
  process.env.CALENDAR_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,7).toString('base64');
  const cipher=encryptToken('refresh-test');assert(!cipher.includes('refresh-test'));assert.equal(decryptToken(cipher),'refresh-test');
  const parts=cipher.split('.');parts[2]=Buffer.alloc(16,1).toString('base64url');assert.throws(()=>decryptToken(parts.join('.')));
});
test('notification input requires phone and consent for opt-in channels',()=>{
  assert.equal(bookingSchema.safeParse({...booking,phone:''}).success,false);
  assert.equal(bookingSchema.safeParse({...booking,notificationConsent:false}).success,false);
  assert.equal(bookingSchema.safeParse({...booking,day:'2030-02-31'}).success,false);
});
test('off and dry-run never call providers, even after environment changes',async()=>{
  const dependencies={fetcher:(async()=>{throw Error('must not send')}) as typeof fetch};
  assert.equal((await deliver({...job,mode:'off'},env,dependencies)).status,'disabled');
  assert.equal((await deliver({...job,mode:'dry-run'},env,dependencies)).status,'simulated');
  assert.equal((await deliver(job,{...env,NOTIFICATION_MODE:'off'},dependencies)).status,'disabled');
});
test('email uses stable idempotency keys and exposes acceptance not delivery',async()=>{
  const keys:string[]=[];
  const fake=(async(_url:unknown,options:any)=>{keys.push(options.headers['Idempotency-Key']);return Response.json({id:'accepted-id'})}) as typeof fetch;
  assert.equal((await deliver(job,env,{fetcher:fake})).status,'accepted');await deliver(job,env,{fetcher:fake});assert.equal(keys[0],keys[1]);
  assert.equal((await deliver(job,env,{fetcher:(async()=>new Response('',{status:429})) as typeof fetch})).status,'retry');
});
test('Kakao disables SMS fallback and ambiguous SOLAPI results are never blindly retried',async()=>{
  const kakao={...job,channel:'kakao' as const,destination:booking.phone};
  const message=solapiMessage(kakao,env);assert.equal(message.kakaoOptions?.disableSms,true);assert.equal(message.kakaoOptions?.templateId,'confirmed');
  assert.equal((await deliver(kakao,env,{sendSolapi:async()=>{throw Error('timeout')}})).status,'unknown');
  assert.equal((await deliver(kakao,env,{sendSolapi:async()=>({groupInfo:{groupId:'group',count:{registeredSuccess:1}},failedMessageList:[]})})).status,'accepted');
  assert.equal((await deliver(kakao,env,{sendSolapi:async()=>({groupInfo:{groupId:'group'},failedMessageList:[{}]})})).status,'failed');
});

test('PostgreSQL: atomic booking + both-party outbox, RLS, overlap, cancellation and leases',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create schema auth;create role anon;create role authenticated;create role service_role bypassrls;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
    await db.exec(await readFile('supabase/migrations/202609200001_moatime.sql','utf8'));
    await db.exec(await readFile('supabase/migrations/202609200002_calendar_links.sql','utf8'));
    const owner=job.owner_id,other='c0000000-0000-4000-8000-000000000002';
    await db.query('insert into auth.users values ($1,$2),($3,$4)',[owner,'host@example.com',other,'other@example.com']);
    const save=(revision:number,bookings:unknown[],mode='dry-run')=>db.query('select public.moa_save_workspace($1,$2,$3::jsonb,$4::jsonb,$5) as revision',[owner,revision,JSON.stringify(state),JSON.stringify(bookings),mode]);
    await save(0,[booking]);
    const q=await db.query<{channel:string;recipient_role:string;destination:string}>('select channel,recipient_role,destination from moa_notification_jobs order by channel,recipient_role');
    assert.equal(q.rows.length,4);assert(q.rows.some(r=>r.recipient_role==='host'&&r.destination==='host@example.com'));assert(q.rows.some(r=>r.recipient_role==='guest'&&r.destination==='guest@example.com'));
    await assert.rejects(save(0,[booking]),/stale_revision/);
    await assert.rejects(save(1,[booking,{...booking,id:'a0000000-0000-4000-8000-000000000002',time:'10:15'}]),/overlapping_booking/);
    assert.equal((await db.query<{c:number}>('select count(*)::int c from moa_bookings')).rows[0].c,1);
    assert.equal((await db.query<{revision:number}>('select revision from moa_workspaces')).rows[0].revision,1);
    await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${other}',false);`);
    assert.equal((await db.query('select * from moa_bookings')).rows.length,0);
    await assert.rejects(db.exec('delete from moa_bookings'),/permission denied/);
    await assert.rejects(db.exec(`select moa_claim_notifications(10,null)`),/permission denied/);
    await db.exec('reset role');
    const claimed=await db.query<{id:string;lease_token:string}>('select * from moa_claim_notifications(2,null)');assert.equal(claimed.rows.length,2);assert(claimed.rows[0].lease_token);
    const next=await db.query<{id:string}>('select * from moa_claim_notifications(20,null)');assert.equal(next.rows.length,2);assert(!next.rows.some(x=>claimed.rows.some(y=>x.id===y.id)));
    await db.exec(`update moa_notification_jobs set lease_until=now()-interval '1 minute' where channel in ('sms','kakao');`);
    await db.query('select * from moa_claim_notifications(20,null)');
    assert.equal((await db.query<{c:number}>("select count(*)::int c from moa_notification_jobs where status='unknown'")).rows[0].c,2);
    await save(1,[]);
    assert.equal((await db.query<{status:string}>('select status from moa_bookings')).rows[0].status,'cancelled');
    assert.equal((await db.query<{c:number}>("select count(*)::int c from moa_notification_jobs where event_type='cancelled'")).rows[0].c,4);
    await save(2,[]);assert.equal((await db.query<{c:number}>("select count(*)::int c from moa_notification_jobs where event_type='cancelled'")).rows[0].c,4);
  }finally{await db.close()}
});
