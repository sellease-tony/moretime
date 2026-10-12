import {test} from 'node:test';
import assert from 'node:assert/strict';
import {syncGoogleEvent} from '../lib/calendar/events';
import {deliver,noticeText,type NoticeJob} from '../lib/notifications/providers';
const booking={id:'a0000000-0000-4000-8000-000000000001',title:'상담',name:'예약자',email:'guest@example.com',day:'2030-01-01',time:'10:00',duration:30};
const meet='https://meet.google.com/abc-defg-hij';
type Call={url:string;method:string;body?:Record<string,unknown>};
function google(respond:(c:Call,n:number)=>Response){
 const calls:Call[]=[];
 const request=async(url:URL|RequestInfo,init?:RequestInit)=>{const c={url:String(url),method:init?.method||'GET',body:init?.body?JSON.parse(String(init.body)):undefined};calls.push(c);return respond(c,calls.length)};
 return {calls,request:request as typeof fetch};
}

test('online bookings create a Meet conference keyed by the booking id and return its link',async()=>{
 const g=google((c,n)=>n===1?new Response(null,{status:404}):Response.json({...c.body,hangoutLink:meet}));
 const result=await syncGoogleEvent('t',{...booking,meetingMode:'online'},false,g.request);
 assert.equal(result.meetUrl,meet);
 const insert=g.calls[1];
 assert.match(insert.url,/conferenceDataVersion=1/);
 assert.deepEqual(insert.body?.conferenceData,{createRequest:{requestId:booking.id,conferenceSolutionKey:{type:'hangoutsMeet'}}});
});

test('offline bookings get no conference, and a refused Meet still creates the calendar event',async()=>{
 const offline=google((c,n)=>n===1?new Response(null,{status:404}):Response.json(c.body));
 assert.equal((await syncGoogleEvent('t',{...booking,meetingMode:'offline'},false,offline.request)).meetUrl,undefined);
 assert.doesNotMatch(offline.calls[1].url,/conferenceDataVersion/);
 assert.equal(offline.calls[1].body?.conferenceData,undefined);

 const refused=google((c,n)=>n===1?new Response(null,{status:404}):n===2?new Response(null,{status:403}):Response.json(c.body));
 const result=await syncGoogleEvent('t',booking,false,refused.request);
 assert.equal(result.meetUrl,undefined);
 assert.equal(refused.calls.length,3,'retried once without the conference');
 assert.equal(refused.calls[2].body?.conferenceData,undefined);
});

test('an already created event returns its existing Meet link without writing again',async()=>{
 const g=google(()=>Response.json({extendedProperties:{private:{moaBookingId:booking.id}},conferenceData:{entryPoints:[{entryPointType:'phone',uri:'tel:+1'},{entryPointType:'video',uri:meet}]}}));
 assert.equal((await syncGoogleEvent('t',booking,false,g.request)).meetUrl,meet);
 assert.equal(g.calls.length,1);
});

test('emails show the Meet link on confirmations and reminders but never on cancellations',async()=>{
 const job={id:'j',booking_id:booking.id,channel:'email',recipient_role:'guest',event_type:'confirmed',destination:'guest@example.com',mode:'live',payload:{...booking,meetUrl:meet}} as NoticeJob;
 assert.match(noticeText(job),/화상 회의\(Google Meet\): https:\/\/meet\.google\.com\/abc-defg-hij/);
 assert.match(noticeText({...job,event_type:'reminder_1h'}),/Google Meet/);
 assert.doesNotMatch(noticeText({...job,event_type:'cancelled'}),/Google Meet/);
 assert.doesNotMatch(noticeText({...job,payload:{...booking}}),/Google Meet/);
 const env={NOTIFICATION_MODE:'live',RESEND_API_KEY:'k',EMAIL_FROM:'f@example.com'};
 let sent:{text:string}|undefined;
 await deliver(job,env,{fetcher:(async(_u:unknown,init?:RequestInit)=>{sent=JSON.parse(String(init?.body));return Response.json({id:'ok'})}) as typeof fetch});
 assert.match(sent!.text,/meet\.google\.com/);
});
