import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collectAnswers,answersText,questionsSchema,type Question} from '../lib/bookings/questions';
import {eventSchema,bookingSchema} from '../lib/workspace';
import {noticeText,type NoticeJob} from '../lib/notifications/providers';
import {syncGoogleEvent} from '../lib/calendar/events';

const qs:Question[]=[{id:'qtopic',label:'상담 내용',type:'long',required:true},{id:'qsize',label:'참석 인원',type:'short',required:false}];

test('answers follow the page questions: required checked, unknown keys ignored, labels copied',()=>{
 assert.deepEqual(collectAnswers(qs,{qtopic:'  가격 문의\r\n두 번째 줄 ',qsize:'',qhack:'x'}),[{id:'qtopic',label:'상담 내용',value:'가격 문의\n두 번째 줄'}]);
 assert.throws(()=>collectAnswers(qs,{qsize:'3명'}),/상담 내용/);
 assert.throws(()=>collectAnswers(qs,{qtopic:'a'.repeat(1001)}),/1000자/);
 assert.throws(()=>collectAnswers([{id:'qa',label:'회사',type:'short',required:false}],{qa:'a'.repeat(201)}),/200자/);
 assert.deepEqual(collectAnswers(undefined,{qtopic:'x'}),[]);
 assert.deepEqual(collectAnswers(qs.slice(1),'not-an-object'),[]);
});

test('short answers lose line breaks and control characters; long answers keep line breaks only',()=>{
 assert.equal(collectAnswers([{id:'qa',label:'a',type:'short',required:true}],{qa:'첫\n줄\u0007끝'})[0].value,'첫 줄 끝');
 assert.equal(collectAnswers([{id:'qa',label:'a',type:'long',required:true}],{qa:'첫\n줄\u0007끝'})[0].value,'첫\n줄끝');
});

test('pages accept at most five uniquely identified questions, and bookings store answers',()=>{
 assert.equal(questionsSchema.safeParse(Array.from({length:5},(_,i)=>({id:'q'+i,label:'질문',type:'short',required:false}))).success,true);
 assert.equal(questionsSchema.safeParse(Array.from({length:6},(_,i)=>({id:'q'+i,label:'질문',type:'short',required:false}))).success,false);
 assert.equal(questionsSchema.safeParse([qs[0],qs[0]]).success,false);
 assert.equal(questionsSchema.safeParse([{...qs[0],id:'bad id'}]).success,false);
 const event={id:'e',title:'상담',desc:'',duration:30,color:'blue',team:false,active:true,questions:qs};
 assert.equal(eventSchema.safeParse(event).success,true);
 const booking={id:'a0000000-0000-4000-8000-000000000001',eventId:'e',title:'상담',duration:30,day:'2030-01-01',time:'10:00',name:'예약자',email:'g@x.io',answers:[{id:'qtopic',label:'상담 내용',value:'가격'}]};
 assert.equal(bookingSchema.safeParse(booking).success,true);
 assert.equal(bookingSchema.safeParse({...booking,answers:[{id:'qtopic',label:'상담 내용',value:'가격',extra:1}]}).success,false);
});

test('the host confirmation email and calendar event include the answers; the guest email does not',async()=>{
 const payload={id:'a0000000-0000-4000-8000-000000000001',eventId:'e',title:'상담',duration:30,day:'2030-01-01',time:'10:00',name:'예약자',email:'g@x.io',phone:'',channels:['email'],notificationConsent:true,answers:[{id:'qtopic',label:'상담 내용',value:'가격 문의'}]} as NoticeJob['payload'];
 const job=(role:'host'|'guest',event:NoticeJob['event_type']='confirmed')=>({id:'j',owner_id:'o',booking_id:payload.id,channel:'email',recipient_role:role,event_type:event,destination:'x@x.io',payload,mode:'live',attempts:0,lease_token:'t',created_at:'',expires_at:''}) as NoticeJob;
 assert.match(noticeText(job('host')),/질문 응답\n상담 내용\n가격 문의/);
 assert.doesNotMatch(noticeText(job('guest')),/가격 문의/);
 assert.doesNotMatch(noticeText(job('host','cancelled')),/가격 문의/);
 assert.equal(answersText(payload.answers),'상담 내용\n가격 문의');
 const calls:{method:string;body?:{description?:string}}[]=[];
 const request=(async(_u:unknown,init?:RequestInit)=>{const c={method:init?.method||'GET',body:init?.body?JSON.parse(String(init.body)):undefined};calls.push(c);return calls.length===1?new Response(null,{status:404}):Response.json(c.body)}) as typeof fetch;
 await syncGoogleEvent('t',{id:payload.id,title:'상담',name:'예약자',email:'g@x.io',day:'2030-01-01',time:'10:00',duration:30,meetingMode:'offline',answers:payload.answers},false,request);
 assert.match(String(calls[1].body?.description),/상담 내용\n가격 문의/);
});
