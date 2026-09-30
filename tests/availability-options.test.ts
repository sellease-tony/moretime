import {test} from 'node:test';
import assert from 'node:assert/strict';
import {availableSlots} from '../lib/calendar/google';
import {permitsTime,savedSlots} from '../lib/availability';
import {applyCalendarBusy} from '../lib/calendar/availability-state';
const now=new Date('2030-01-01T00:00:00Z'),week=Array(7).fill(true);
test('slot cadence follows duration and aligns consistently between manual and range generation',()=>{
 assert.deepEqual(availableSlots('2030-01-07',60,week,['09:00','12:00'],[],now),['09:00','10:00','11:00']);
 assert.deepEqual(availableSlots('2030-01-07',30,week,['09:00','11:00'],[],now),['09:00','09:30','10:00','10:30']);
 assert.deepEqual(availableSlots('2030-01-07',15,week,['09:00','10:00'],[],now),['09:00','09:15','09:30','09:45']);
 assert.deepEqual(availableSlots('2030-01-07',60,week,['09:30','12:00'],[],now),['10:00','11:00']);
});
test('weekend and lunch options include when enabled and exclude entire overlapping meetings when disabled',()=>{
 assert.equal(permitsTime({includeWeekends:false},'2030-01-05','10:00',60),false);
 assert.equal(permitsTime({includeWeekends:true},'2030-01-05','10:00',60),true);
 assert.equal(permitsTime({includeLunch:false},'2030-01-07','11:30',60),false);
 assert.equal(permitsTime({includeLunch:false},'2030-01-07','11:00',60),true);
 assert.equal(permitsTime({includeLunch:false},'2030-01-07','13:00',60),true);
 assert.equal(permitsTime({includeLunch:true},'2030-01-07','12:00',60),true);
});
test('saved guest availability and background sync enforce options and remove old half-hour starts for hour meetings',()=>{
 const availability={days:{'2030-01-07':['11:00','11:30','12:00','13:00'],'2030-01-05':['10:00']},source:'manual' as const,updatedAt:now.toISOString(),includeWeekends:false,includeLunch:false};
 assert.deepEqual(savedSlots(availability,'2030-01-07',60,[],now),['11:00','13:00']);
 const state={events:[{id:'one',duration:60,availability}]};
 const result=applyCalendarBusy(state,[],now);
 assert.deepEqual(result.events[0].availability.days['2030-01-05'],[]);
 assert.deepEqual(result.events[0].availability.days['2030-01-07'],['11:00','13:00']);
});
