import {test} from 'node:test';
import assert from 'node:assert/strict';
import {submitGuestBooking} from '../lib/bookings/submit-guest';
test('guest submission returns actionable validation errors and allows a corrected retry with same ID',async()=>{
 const ids:string[]=[];
 const fetcher=(async(_url:unknown,init?:RequestInit)=>{const body=JSON.parse(String(init?.body));ids.push(body.id);return body.phone==='bad'?Response.json({error:'휴대전화 번호를 확인해 주세요.'},{status:400}):Response.json({ok:true,manageUrl:'/booking/manage#test'})}) as typeof fetch;
 const failed=await submitGuestBooking('page',{id:'same',phone:'bad'},fetcher);assert.equal(failed.ok,false);if(!failed.ok)assert.match(failed.error,/휴대전화/);
 const success=await submitGuestBooking('page',{id:'same',phone:'01012345678'},fetcher);assert.equal(success.ok,true);assert.deepEqual(ids,['same','same']);
});
test('guest submission releases a hanging request and handles non-JSON server failures',async()=>{
 const hanging=((_u:unknown,init?:RequestInit)=>new Promise<Response>((_,reject)=>init?.signal?.addEventListener('abort',()=>reject(Error('aborted'))))) as typeof fetch;
 const timeout=await submitGuestBooking('page',{id:'same'},hanging,5);assert.equal(timeout.ok,false);if(!timeout.ok)assert.match(timeout.error,/중복 없이/);
 const bad=await submitGuestBooking('page',{},(async()=>new Response('Bad gateway',{status:502})) as typeof fetch);assert.equal(bad.ok,false);if(!bad.ok)assert.match(bad.error,/서버 응답/);
});
