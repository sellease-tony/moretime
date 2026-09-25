import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bookingStatus,seoulDay} from '../lib/bookings/status';
const b={day:'2026-09-25',time:'23:45',duration:30};
test('KST meeting progresses at start and completes exactly at end across midnight',()=>{
 assert.equal(bookingStatus(b,Date.parse('2026-09-25T14:44:59Z')),'upcoming');
 assert.equal(bookingStatus(b,Date.parse('2026-09-25T14:45:00Z')),'ongoing');
 assert.equal(bookingStatus(b,Date.parse('2026-09-25T15:14:59Z')),'ongoing');
 assert.equal(bookingStatus(b,Date.parse('2026-09-25T15:15:00Z')),'completed');
});
test('calendar date uses Seoul regardless of the browser timezone',()=>{
 assert.equal(seoulDay(Date.parse('2026-09-25T15:00:00Z')),'2026-09-26');
});
