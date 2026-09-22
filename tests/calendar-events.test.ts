import {test} from 'node:test';
import assert from 'node:assert/strict';
import {syncGoogleEvent,calendarEventId} from '../lib/calendar/events';
const booking={id:'a0000000-0000-4000-8000-000000000001',title:'상담',name:'예약자',email:'guest@example.com',day:'2030-01-01',time:'10:00',duration:30};
test('writes the host primary calendar with stable ID, Korean time and no guest invitation',async()=>{
  let calls=0;
  const request=async(url:URL|RequestInfo,init?:RequestInit)=>{calls++;assert(String(url).includes('/calendars/primary/events'));assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer host-token');if(calls===1)return new Response(null,{status:404});const event=JSON.parse(String(init?.body));assert.equal(event.id,calendarEventId(booking.id));assert.equal(event.start.dateTime,'2030-01-01T01:00:00.000Z');assert.equal(event.end.dateTime,'2030-01-01T01:30:00.000Z');assert.equal(event.attendees,undefined);return Response.json(event)};
  await syncGoogleEvent('host-token',booking,false,request as typeof fetch);assert.equal(calls,2);
});
test('retries do not duplicate events; cancellation deletes only the matching event',async()=>{
  let writes=0;const request=async(_url:URL|RequestInfo,init?:RequestInit)=>{if(init?.method==='DELETE'){writes++;return new Response(null,{status:204})}return Response.json({extendedProperties:{private:{moaBookingId:booking.id}}})};
  await syncGoogleEvent('host',booking,false,request as typeof fetch);assert.equal(writes,0);
  await syncGoogleEvent('host',booking,true,request as typeof fetch);assert.equal(writes,1);
  await assert.rejects(syncGoogleEvent('host',booking,true,(async()=>Response.json({extendedProperties:{private:{moaBookingId:'different'}}})) as typeof fetch),/충돌/);
});
test('lost insert response conflicts are verified, and missing write permission fails visibly',async()=>{
  let calls=0;await syncGoogleEvent('host',booking,false,(async()=>{calls++;return calls===1?new Response(null,{status:404}):calls===2?new Response(null,{status:409}):Response.json({extendedProperties:{private:{moaBookingId:booking.id}}})}) as typeof fetch);assert.equal(calls,3);
  await assert.rejects(syncGoogleEvent('host',booking,false,(async()=>new Response(null,{status:403})) as typeof fetch),/쓰기 권한/);
});
