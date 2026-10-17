import {test} from 'node:test';
import assert from 'node:assert/strict';
import {syncGoogleEvent} from '../lib/calendar/events';
import {safeReturnPath} from '../lib/site';
const id='a0000000-0000-4000-8000-000000000001';
const hostLink=`https://moretime.sellease.io/app?booking=${id}`;
const booking={id,title:'상담',name:'예약자',email:'guest@example.com',day:'2030-01-01',time:'10:00',duration:30,meetingMode:'offline' as const,hostLink};
type Call={url:string;method:string;body?:Record<string,unknown>};
function google(respond:(c:Call,n:number)=>Response){
 const calls:Call[]=[];
 const request=async(url:URL|RequestInfo,init?:RequestInit)=>{const c={url:String(url),method:init?.method||'GET',body:init?.body?JSON.parse(String(init.body)):undefined};calls.push(c);return respond(c,calls.length)};
 return {calls,request:request as typeof fetch};
}

test('new calendar events carry the host-only booking link, never the guest management link',async()=>{
 const g=google((c,n)=>n===1?new Response(null,{status:404}):Response.json(c.body));
 await syncGoogleEvent('t',booking,false,g.request);
 const description=String(g.calls[1].body?.description);
 assert.match(description,/예약 변경·취소\(주최자 로그인 필요\): https:\/\/moretime\.sellease\.io\/app\?booking=a0000000/);
 assert.doesNotMatch(description,/token=/);
});

test('an existing event without the link is patched once; one that has it is left alone',async()=>{
 const old=google(c=>c.method==='PATCH'?Response.json({}):Response.json({extendedProperties:{private:{moaBookingId:id}},description:'모아타임 예약\n예약자: 예약자'}));
 await syncGoogleEvent('t',booking,false,old.request);
 const patch=old.calls.find(c=>c.method==='PATCH');
 assert.ok(patch,'description is patched');
 assert.match(patch!.url,/sendUpdates=none/);
 assert.match(String(patch!.body?.description),/app\?booking=/);

 const current=google(()=>Response.json({extendedProperties:{private:{moaBookingId:id}},description:'… '+hostLink}));
 await syncGoogleEvent('t',booking,false,current.request);
 assert.equal(current.calls.filter(c=>c.method==='PATCH').length,0);

 const failing=google(c=>c.method==='PATCH'?new Response(null,{status:500}):Response.json({extendedProperties:{private:{moaBookingId:id}}}));
 await syncGoogleEvent('t',booking,false,failing.request);
});

test('only an exact booking deep link survives the login round trip',()=>{
 assert.equal(safeReturnPath(`/app?booking=${id}`),`/app?booking=${id}`);
 for(const bad of ['/app','https://evil.example/app?booking='+id,'//evil.example',`/app?booking=${id}&x=1`,'/app?booking=nope',null,undefined])assert.equal(safeReturnPath(bad),null);
});
