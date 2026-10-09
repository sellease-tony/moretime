import test from 'node:test';
import assert from 'node:assert/strict';
import {googleCalendarUrl,icsContent} from '../lib/bookings/calendar-links';
import {nextAvailableDay,type Availability} from '../lib/availability';
const m={id:'10000000-0000-4000-8000-000000000001',title:'ABC × 제안 미팅, 1차; 상담',day:'2030-01-02',time:'09:30',duration:60,details:'관리 링크\n변경 가능'};

test('Google Calendar link converts KST wall time to UTC and keeps the title',()=>{
 const u=new URL(googleCalendarUrl(m));
 assert.equal(u.searchParams.get('dates'),'20300102T003000Z/20300102T013000Z');
 assert.equal(u.searchParams.get('text'),m.title);
 assert.equal(u.searchParams.get('ctz'),'Asia/Seoul');
});

test('ICS uses CRLF, a stable UID and escaped text fields',()=>{
 const ics=icsContent(m,new Date('2029-12-01T00:00:00Z'));
 assert.ok(ics.endsWith('\r\n'));
 assert.ok(!ics.replace(/\r\n/g,'').includes('\n'),'no bare LF line breaks');
 assert.match(ics,/UID:10000000-0000-4000-8000-000000000001@moatime\r\n/);
 assert.match(ics,/DTSTART:20300102T003000Z\r\nDTEND:20300102T013000Z/);
 assert.ok(ics.includes('SUMMARY:ABC × 제안 미팅\\, 1차\\; 상담\r\n'));
 assert.ok(ics.includes('DESCRIPTION:관리 링크\\n변경 가능\r\n'));
});

test('next available day skips past, full and out-of-range days',()=>{
 const a:Availability={source:'manual',updatedAt:'x',days:{'2030-01-01':['09:00'],'2030-01-03':['10:00'],'2030-01-05':['11:00'],'2030-03-01':['09:00']}};
 const now=new Date('2030-01-01T12:00:00+09:00');
 const busy=[{start:'2030-01-03T10:00:00+09:00',end:'2030-01-03T11:00:00+09:00'}];
 assert.equal(nextAvailableDay(a,'2030-01-01','2030-02-28',60,busy,now),'2030-01-05');
 assert.equal(nextAvailableDay(a,'2030-01-06','2030-02-28',60,[],now),null);
 assert.equal(nextAvailableDay(undefined,'2030-01-01','2030-12-31',60,[],now),null);
});
