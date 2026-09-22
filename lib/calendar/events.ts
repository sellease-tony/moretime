import {CalendarError} from './google';
export type CalendarBooking={id:string;title:string;name:string;email:string;day:string;time:string;duration:number};
export const calendarEventId=(id:string)=>'moa'+id.replaceAll('-','').toLowerCase();
// Stable IDs make retries safe even when Google accepted a request but the response was lost.
export async function syncGoogleEvent(token:string,booking:CalendarBooking,cancelled=false,request:typeof fetch=fetch){
  const id=calendarEventId(booking.id),base='https://www.googleapis.com/calendar/v3/calendars/primary/events';
  const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
  const call=(url:string,init:RequestInit={})=>request(url,{...init,headers,cache:'no-store',signal:AbortSignal.timeout(8000)});
  const existing=await call(`${base}/${id}`);
  if(existing.ok){
    const event=await existing.json();
    if(event.status==='cancelled'){if(cancelled)return;throw new CalendarError('Google에서 삭제된 예약 일정입니다. 주최자가 확인해 주세요.');}
    if(event.extendedProperties?.private?.moaBookingId!==booking.id)throw new CalendarError('캘린더 일정 식별자가 충돌했습니다.');
    if(!cancelled)return;
    const deleted=await call(`${base}/${id}?sendUpdates=none`,{method:'DELETE'});
    if(!deleted.ok&&![404,410].includes(deleted.status))throw new CalendarError('캘린더 일정 취소를 다시 시도해 주세요.');
    return;
  }
  if(![404,410].includes(existing.status))throw new CalendarError('주최자의 캘린더 쓰기 권한을 확인하고 Google을 다시 연결해 주세요.');
  if(cancelled)return;
  const start=new Date(`${booking.day}T${booking.time}:00+09:00`);
  const inserted=await call(base+'?sendUpdates=none',{method:'POST',body:JSON.stringify({id,summary:booking.title,description:`모아타임 예약\n예약자: ${booking.name}\n이메일: ${booking.email}`,start:{dateTime:start.toISOString(),timeZone:'Asia/Seoul'},end:{dateTime:new Date(start.getTime()+booking.duration*60000).toISOString(),timeZone:'Asia/Seoul'},extendedProperties:{private:{moaBookingId:booking.id}}})});
  if(inserted.status===409){
    const retry=await call(`${base}/${id}`);const event=retry.ok?await retry.json():null;
    if(event?.status!=='cancelled'&&event?.extendedProperties?.private?.moaBookingId===booking.id)return;
  }
  if(!inserted.ok)throw new CalendarError('예약은 저장되었지만 주최자의 Google 캘린더 등록을 다시 시도해야 합니다.');
}
