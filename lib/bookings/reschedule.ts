import {overlaps,type Busy} from '@/lib/calendar/google';
import {meetingRange} from './calendar-links';
export const RESCHEDULE_ERRORS:Record<string,string>={
 booking_started:'이미 시작된 예약은 변경할 수 없습니다.',
 booking_changed:'예약이 이미 변경되었습니다. 새로고침 후 다시 확인해 주세요.',
 booking_cancelled:'취소된 예약은 변경할 수 없습니다.',
 poll_booking:'여러 명 일정 투표로 확정된 일정은 여기서 변경할 수 없습니다.',
 same_time:'현재 예약과 다른 시간을 선택해 주세요.',
 invalid_time:'지금 이후 1년 안의 날짜와 시간을 선택해 주세요.',
 overlapping_booking:'그 시간에 다른 예약이 있습니다. 다른 시간을 선택해 주세요.',
 not_found:'예약을 찾을 수 없습니다.',
};
export function rescheduleError(message:string){const key=Object.keys(RESCHEDULE_ERRORS).find(k=>message.includes(k));return key?RESCHEDULE_ERRORS[key]:'일정을 변경하지 못했습니다. 다시 시도해 주세요.'}
// Google busy blocks at the new time, ignoring the booking's own calendar event at its current time.
export function googleConflict(busy:Busy[],next:{day:string;time:string;duration:number},current:{day:string;time:string;duration:number},bufferMinutes=0){
 const n=meetingRange(next),c=meetingRange(current);
 const others=busy.filter(b=>!(Date.parse(b.start)===c.start.getTime()&&Date.parse(b.end)===c.end.getTime()));
 return overlaps(n.start.toISOString(),n.end.toISOString(),others,bufferMinutes);
}
