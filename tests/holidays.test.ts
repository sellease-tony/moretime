import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseKoreanHolidays} from '../lib/calendar/holidays';
import {applyCalendarBusy,type CalendarState} from '../lib/calendar/availability-state';
const event=(date:string,name:string,description='Public holiday',status='CONFIRMED')=>`BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:${date}\r\nDTEND;VALUE=DATE:${String(Number(date)+1)}\r\nSUMMARY:${name}\r\nDESCRIPTION:${description}\r\nSTATUS:${status}\r\nEND:VEVENT\r\n`;
test('Korean public holidays include substitute days but exclude observances and cancelled entries',()=>{
 const ics='BEGIN:VCALENDAR\r\n'+event('20261003','개천절')+event('20261005','대체공휴일')+event('20261001','기념일','Observance')+event('20261002','취소','Public holiday','CANCELLED')+'END:VCALENDAR';
 assert.deepEqual(parseKoreanHolidays(ics,'2026-10-01','2026-10-05'),{'2026-10-03':'개천절','2026-10-05':'대체공휴일'});
 assert.deepEqual(parseKoreanHolidays(ics,'2026-10-04','2026-10-05'),{'2026-10-05':'대체공휴일'});
 assert.throws(()=>parseKoreanHolidays(ics,'2026-12-01','2027-01-10'),/해당 연도/);
 assert.throws(()=>parseKoreanHolidays('<html>Unavailable</html>','2026-10-01','2026-10-05'));
});
test('public holidays default to excluded, setting off restores selections without reopening Google conflicts',()=>{
 const now=new Date('2026-09-29T00:00:00+09:00');
 const state:CalendarState={events:[{id:'page',duration:60,availability:{source:'manual',updatedAt:now.toISOString(),days:{'2026-10-05':['09:00','09:30','10:00'],'2026-11-10':['09:00','10:00']}}}]};
 const busy=[{start:'2026-10-05T09:30:00+09:00',end:'2026-10-05T10:00:00+09:00'},{start:'2026-11-10T09:00:00+09:00',end:'2026-11-10T10:00:00+09:00'}];
 const synced=applyCalendarBusy(state,busy,now,true,{'2026-10-05':'대체공휴일'});
 assert.deepEqual(synced.events[0].availability!.days['2026-10-05'],[]);
 assert.deepEqual(synced.events[0].availability!.days['2026-11-10'],['10:00']);
 synced.events[0].availability!.excludeHolidays=false;
 const reopened=applyCalendarBusy(synced,busy,now,true,{'2026-10-05':'대체공휴일'});
 assert.deepEqual(reopened.events[0].availability!.days['2026-10-05'],['10:00']);
});
