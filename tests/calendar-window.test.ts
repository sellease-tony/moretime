import {test} from 'node:test';
import assert from 'node:assert/strict';
import {queryGoogleBusy} from '../lib/calendar/google';
test('93-day lookup splits into contiguous <=30-day windows and keeps final-day conflicts',async()=>{
 const start='2030-01-01T00:00:00.000Z',end=new Date(Date.parse(start)+93*86400000).toISOString();
 const windows:{timeMin:string;timeMax:string}[]=[];
 const fetcher=async(_url:unknown,init?:RequestInit)=>{if(!init?.body)return Response.json({items:[{id:'primary',primary:true}]});const b=JSON.parse(String(init.body));windows.push(b);assert.ok(Date.parse(b.timeMax)-Date.parse(b.timeMin)<=30*86400000);return Response.json({calendars:{primary:{busy:[{start:b.timeMin,end:b.timeMax}]}}})};
 const result=await queryGoogleBusy('test',start,end,fetcher as typeof fetch);
 assert.equal(windows.length,4);assert.equal(windows[0].timeMin,start);assert.equal(windows[3].timeMax,end);assert.equal(result.length,4);
 for(let i=1;i<windows.length;i++)assert.equal(windows[i-1].timeMax,windows[i].timeMin);
});
test('a failed later window never returns partial availability',async()=>{
 let calls=0;const fetcher=async(_url:unknown,init?:RequestInit)=>{if(!init?.body)return Response.json({items:[{id:'primary',primary:true}]});calls++;return calls===2?new Response(null,{status:503}):Response.json({calendars:{primary:{busy:[]}}})};
 await assert.rejects(queryGoogleBusy('test','2030-01-01T00:00:00Z','2030-04-04T00:00:00Z',fetcher as typeof fetcher),/조회에 실패/);
});
