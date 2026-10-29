import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {newFlow,sha256hex} from '../lib/auth/google-oauth';
import {microsoftAuthorizeUrl,exchangeMicrosoftCode,refreshMicrosoftToken,MICROSOFT_SCOPES} from '../lib/auth/microsoft-oauth';
import {queryMicrosoftBusy,syncMicrosoftEvent} from '../lib/calendar/microsoft';
import {isHost,isOAuthAccount} from '../lib/auth/role';

type Call={url:string;method:string;body?:Record<string,unknown>};
function graph(respond:(c:Call,n:number)=>Response){
 const calls:Call[]=[];
 const request=(async(url:URL|RequestInfo,init?:RequestInit)=>{const b=init?.body;const c={url:String(url),method:init?.method||'GET',body:typeof b==='string'&&b.startsWith('{')?JSON.parse(b):undefined};calls.push(c);return respond(c,calls.length)}) as typeof fetch;
 return {calls,request};
}
const booking={id:'a0000000-0000-4000-8000-000000000001',title:'상담',name:'예약자',email:'g@x.io',day:'2030-01-01',time:'10:00',duration:30,meetingMode:'online' as const};

test('Microsoft sign-in uses our callback, PKCE, a hashed nonce and the calendar scopes on the common endpoint',()=>{
 const flow=newFlow({consent:'2026-10-12'});
 const u=new URL(microsoftAuthorizeUrl(flow,'ms-client',`https://moretime.sellease.io`));
 assert.equal(u.origin+u.pathname,'https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
 const q=u.searchParams;
 assert.equal(q.get('redirect_uri'),'https://moretime.sellease.io/auth/microsoft/callback');
 assert.equal(q.get('scope'),MICROSOFT_SCOPES);
 assert.match(MICROSOFT_SCOPES,/offline_access/);assert.match(MICROSOFT_SCOPES,/Calendars\.ReadWrite/);
 assert.equal(q.get('code_challenge'),createHash('sha256').update(flow.verifier).digest('base64url'));
 assert.equal(q.get('nonce'),sha256hex(flow.nonce));
 assert.equal(q.get('state'),flow.state);
});

test('code exchange and refresh return tokens, keep rotated refresh tokens and reject incomplete replies',async()=>{
 process.env.MICROSOFT_CLIENT_ID='ms-client';process.env.MICROSOFT_CLIENT_SECRET='ms-secret';
 const flow=newFlow({});let sent:URLSearchParams|undefined;
 const ok=(async(_u:unknown,init?:RequestInit)=>{sent=init?.body as URLSearchParams;return Response.json({id_token:'id',access_token:'at',refresh_token:'rt'})}) as typeof fetch;
 assert.deepEqual(await exchangeMicrosoftCode('c',flow,'https://moretime.sellease.io',ok),{id_token:'id',access_token:'at',refresh_token:'rt'});
 assert.equal(sent?.get('code_verifier'),flow.verifier);
 assert.equal(sent?.get('client_secret'),'ms-secret');
 await assert.rejects(exchangeMicrosoftCode('c',flow,'https://x',(async()=>Response.json({access_token:'at'})) as typeof fetch));
 assert.deepEqual(await refreshMicrosoftToken('old',(async()=>Response.json({access_token:'at2',refresh_token:'new'})) as typeof fetch),{access_token:'at2',refresh_token:'new'});
 await assert.rejects(refreshMicrosoftToken('old',(async()=>Response.json({error:'invalid_grant'},{status:400})) as typeof fetch));
});

test('Outlook busy times skip free, working-elsewhere and cancelled events, read UTC times and follow pages',async()=>{
 const g=graph((c,n)=>n===1?Response.json({value:[
  {start:{dateTime:'2030-01-01T01:00:00.0000000',timeZone:'UTC'},end:{dateTime:'2030-01-01T02:00:00.0000000',timeZone:'UTC'},showAs:'busy'},
  {start:{dateTime:'2030-01-01T03:00:00.0000000',timeZone:'UTC'},end:{dateTime:'2030-01-01T04:00:00.0000000',timeZone:'UTC'},showAs:'free'},
  {start:{dateTime:'2030-01-01T05:00:00.0000000',timeZone:'UTC'},end:{dateTime:'2030-01-01T06:00:00.0000000',timeZone:'UTC'},showAs:'workingElsewhere'},
  {start:{dateTime:'2030-01-01T07:00:00.0000000',timeZone:'UTC'},end:{dateTime:'2030-01-01T08:00:00.0000000',timeZone:'UTC'},showAs:'busy',isCancelled:true},
 ],'@odata.nextLink':'https://graph.microsoft.com/v1.0/me/calendarView?page=2'}):Response.json({value:[{start:{dateTime:'2030-01-02T01:00:00.0000000',timeZone:'UTC'},end:{dateTime:'2030-01-02T01:30:00.0000000',timeZone:'UTC'},showAs:'tentative'}]}));
 const busy=await queryMicrosoftBusy('t','2030-01-01T00:00:00Z','2030-01-03T00:00:00Z',g.request);
 assert.deepEqual(busy,[{start:'2030-01-01T01:00:00.000Z',end:'2030-01-01T02:00:00.000Z'},{start:'2030-01-02T01:00:00.000Z',end:'2030-01-02T01:30:00.000Z'}]);
 assert.match(g.calls[0].url,/\/me\/calendarView\?/);assert.equal(g.calls[1].url,'https://graph.microsoft.com/v1.0/me/calendarView?page=2');
 await assert.rejects(queryMicrosoftBusy('t','2030-01-01T00:00:00Z','2030-01-02T00:00:00Z',graph(()=>new Response(null,{status:401})).request));
});

test('a new online booking creates one Teams event (idempotent by booking ID) and keeps its join link',async()=>{
 const g=graph(c=>Response.json({id:'evt1',onlineMeeting:{joinUrl:'https://teams.microsoft.com/l/meetup-join/x'},...c.body}));
 const r=await syncMicrosoftEvent('t',booking,false,null,g.request);
 assert.deepEqual(r,{eventId:'evt1',meetUrl:'https://teams.microsoft.com/l/meetup-join/x'});
 const body=g.calls[0].body!;
 assert.equal(body.transactionId,booking.id);assert.equal(body.isOnlineMeeting,true);assert.equal(body.onlineMeetingProvider,'teamsForBusiness');
 assert.deepEqual(body.start,{dateTime:'2030-01-01T01:00:00',timeZone:'UTC'});
 assert.deepEqual(body.end,{dateTime:'2030-01-01T01:30:00',timeZone:'UTC'});
});

test('personal accounts that cannot host Teams get the event without a meeting link; offline bookings never ask',async()=>{
 const g=graph((c,n)=>n===1?Response.json({error:{code:'ErrorInvalidRequest'}},{status:400}):Response.json({id:'evt2',...c.body}));
 assert.deepEqual(await syncMicrosoftEvent('t',booking,false,null,g.request),{eventId:'evt2',meetUrl:undefined});
 assert.equal(g.calls[1].body?.isOnlineMeeting,undefined);
 const off=graph(c=>Response.json({id:'evt3',...c.body}));
 await syncMicrosoftEvent('t',{...booking,meetingMode:'offline'},false,null,off.request);
 assert.equal(off.calls.length,1);assert.equal(off.calls[0].body?.isOnlineMeeting,undefined);
});

test('existing events are reused, missing ones recreated, and cancellations delete (already-gone is fine)',async()=>{
 const found=graph(()=>Response.json({id:'evt1',onlineMeeting:{joinUrl:'https://teams.microsoft.com/l/x'}}));
 assert.deepEqual(await syncMicrosoftEvent('t',booking,false,'evt1',found.request),{eventId:'evt1',meetUrl:'https://teams.microsoft.com/l/x'});
 assert.equal(found.calls.length,1);
 const gone=graph((c,n)=>n===1?new Response(null,{status:404}):Response.json({id:'evt9',...c.body}));
 assert.equal((await syncMicrosoftEvent('t',booking,false,'evt1',gone.request)).eventId,'evt9');
 const del=graph(()=>new Response(null,{status:204}));
 assert.deepEqual(await syncMicrosoftEvent('t',booking,true,'evt1',del.request),{eventId:null});
 assert.equal(del.calls[0].method,'DELETE');
 assert.deepEqual(await syncMicrosoftEvent('t',booking,true,'evt1',graph(()=>new Response(null,{status:404})).request),{eventId:null});
 assert.deepEqual(await syncMicrosoftEvent('t',booking,true,null,graph(()=>{throw new Error('no call expected')}).request),{eventId:null});
 await assert.rejects(syncMicrosoftEvent('t',booking,true,'evt1',graph(()=>new Response(null,{status:500})).request));
});

test('Microsoft (Supabase "azure") accounts can be hosts; other providers cannot',()=>{
 assert.equal(isOAuthAccount({provider:'azure'}),true);
 assert.equal(isHost({provider:'azure',moa_role:'host'}),true);
 assert.equal(isHost({provider:'github',moa_role:'host'}),false);
});

test('the migration adds the provider column (google by default) and the booking event ID',async()=>{
 const db=new PGlite();
 await db.exec("create schema auth;create role anon;create role authenticated;create role service_role bypassrls;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;");
 for(const m of ['202609200001_moatime.sql','202609200002_calendar_links.sql','202609250001_calendar_background.sql','202610290001_microsoft_calendar.sql'])await db.exec(await readFile('supabase/migrations/'+m,'utf8'));
 await db.exec("insert into auth.users values ('00000000-0000-4000-8000-000000000001','h@x.io');insert into moa_google_connections(owner_id,refresh_token_enc) values ('00000000-0000-4000-8000-000000000001','x')");
 assert.equal((await db.query<{provider:string}>('select provider from moa_google_connections')).rows[0].provider,'google');
 await assert.rejects(db.exec("update moa_google_connections set provider='yahoo'"));
 await db.exec("update moa_google_connections set provider='microsoft'");
 assert.equal((await db.query<{n:number}>("select count(*)::int n from information_schema.columns where table_name='moa_bookings' and column_name='calendar_event_id'")).rows[0].n,1);
});
