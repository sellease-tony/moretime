import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyCalendarBusy,type CalendarState} from '../lib/calendar/availability-state';
const now=new Date('2030-01-01T00:00:00+09:00');
const state:CalendarState={events:[{id:'host-page',duration:30,availability:{source:'manual',updatedAt:now.toISOString(),days:{'2030-01-02':['09:00','09:30','10:00']}}}]};
test('host Google conflicts remove only overlaps and cancelling them restores original selection',()=>{
 const busy=[{start:'2030-01-02T09:15:00+09:00',end:'2030-01-02T10:00:00+09:00'}];
 const synced=applyCalendarBusy(state,busy,now);
 assert.deepEqual(synced.events[0].availability?.days['2030-01-02'],['10:00']);
 assert.deepEqual(applyCalendarBusy(synced,[],now).events[0].availability?.days['2030-01-02'],['09:00','09:30','10:00']);
 assert.deepEqual(state.events[0].availability?.days['2030-01-02'],['09:00','09:30','10:00']);
});
test('failed Google lookup blocks slots without losing choices; reconnect restores them',()=>{
 const failed=applyCalendarBusy(state,[],now,false);
 assert.equal(failed.calendarSync?.ok,false);
 assert.deepEqual(failed.events[0].availability?.days['2030-01-02'],[]);
 assert.deepEqual(applyCalendarBusy(failed,[],now).events[0].availability?.days['2030-01-02'],['09:00','09:30','10:00']);
});
test('new host selection replaces original choices and all-day events block the entire date',()=>{
 const synced=applyCalendarBusy(state,[],now);
 synced.events[0].availability={source:'manual',updatedAt:'2030-01-01T01:00:00Z',days:{'2030-01-02':['10:00']}};
 const blocked=applyCalendarBusy(synced,[{start:'2030-01-02T00:00:00+09:00',end:'2030-01-03T00:00:00+09:00'}],now);
 assert.deepEqual(blocked.events[0].availability?.days['2030-01-02'],[]);
 assert.deepEqual(applyCalendarBusy(blocked,[],now).events[0].availability?.days['2030-01-02'],['10:00']);
});
