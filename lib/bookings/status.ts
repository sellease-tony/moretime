import type {Booking} from '../workspace';
export function bookingStart(b:Pick<Booking,'day'|'time'>){return Date.parse(`${b.day}T${b.time}:00+09:00`)}
export function bookingStatus(b:Pick<Booking,'day'|'time'|'duration'>,now:number){
  const start=bookingStart(b);
  return now>=start+b.duration*60000?'completed':now>=start?'ongoing':'upcoming';
}
export function seoulDay(now:number){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}
