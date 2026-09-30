import {test} from 'node:test';
import assert from 'node:assert/strict';
import {meetingFields,meetingTemplateSchema,displayMeeting} from '../lib/bookings/meeting';
import {bookingSchema,eventSchema} from '../lib/workspace';
test('company input modes and title templates are server controlled',()=>{
 const e={title:'파트너 미팅',companyMode:'required' as const,meetingTitleTemplate:'{회사명} × 셀리즈 미팅'};
 assert.deepEqual(meetingFields(e,' ABC '),{company:'ABC',meetingTitle:'ABC × 셀리즈 미팅'});
 assert.throws(()=>meetingFields(e,''));assert.throws(()=>meetingFields(e,'a'.repeat(81)));
 assert.equal(meetingFields({...e,companyMode:'hidden'},'ABC').meetingTitle,'파트너 미팅');
 assert.equal(meetingFields({...e,companyMode:'optional'},'').meetingTitle,'파트너 미팅');
 assert.equal(meetingFields({...e,meetingTitleTemplate:'{회사명} / {페이지명}'},'$& {페이지명}').meetingTitle,'$& {페이지명} / 파트너 미팅');
 assert.equal(meetingTemplateSchema.safeParse('{email}').success,false);
 assert.equal(displayMeeting({title:'Old',meetingTitle:'ABC meeting'}),'ABC meeting');
 assert.equal(displayMeeting({title:'Old'}),'Old');
});
test('snapshot fields round trip through booking validation without changing page identity',()=>{
 const b={id:'10000000-0000-4000-8000-000000000001',eventId:'one',title:'파트너 미팅',company:'ABC',meetingTitle:'ABC × 셀리즈 미팅',duration:30,day:'2030-01-07',time:'10:00',name:'Guest',email:'guest@example.com',phone:'01012345678',channels:[],notificationConsent:false};
 assert.deepEqual(bookingSchema.parse(b),b);
 assert.equal(eventSchema.safeParse({id:'one',title:'파트너 미팅',desc:'',duration:30,color:'blue',team:false,active:true,companyMode:'required',meetingTitleTemplate:'{회사명} × 셀리즈 미팅'}).success,true);
});
