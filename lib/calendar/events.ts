import {displayMeeting} from '../bookings/meeting';
import {answersText,type Answer} from '../bookings/questions';
import {CalendarError} from './google';
export type CalendarBooking={id:string;title:string;meetingTitle?:string;name:string;email:string;day:string;time:string;duration:number;meetingMode?:'online'|'offline';hostLink?:string;answers?:Answer[]};
export type CalendarSyncResult={meetUrl?:string};
// The host's own sign-in-protected page for this booking. Never the guest's management link: host calendars are
// often shared with teammates, and that link lets anyone holding it change or cancel the booking.
const describe=(b:CalendarBooking)=>`모아타임 예약\n예약자: ${b.name}\n이메일: ${b.email}`+(b.answers?.length?'\n\n'+answersText(b.answers):'')+(b.hostLink?`\n\n예약 변경·취소(주최자 로그인 필요): ${b.hostLink}`:'');
export const calendarEventId=(id:string)=>'moa'+id.replaceAll('-','').toLowerCase();
const meetLink=(event:{hangoutLink?:string;conferenceData?:{entryPoints?:{entryPointType?:string;uri?:string}[]}}|null)=>event?.hangoutLink||event?.conferenceData?.entryPoints?.find(e=>e.entryPointType==='video')?.uri||undefined;
// Stable IDs make retries safe even when Google accepted a request but the response was lost.
// Online bookings get a Google Meet conference; if the host's account cannot create one (e.g. a Workspace
// policy), the event is still created without it so the booking never fails over the video link.
export async function syncGoogleEvent(token:string,booking:CalendarBooking,cancelled=false,request:typeof fetch=fetch):Promise<CalendarSyncResult>{
  const id=calendarEventId(booking.id),base='https://www.googleapis.com/calendar/v3/calendars/primary/events';
  const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
  const call=(url:string,init:RequestInit={})=>request(url,{...init,headers,cache:'no-store',signal:AbortSignal.timeout(8000)});
  const existing=await call(`${base}/${id}`);
  if(existing.ok){
    const event=await existing.json();
    if(event.status==='cancelled'){if(cancelled)return {};throw new CalendarError('Google에서 삭제된 예약 일정입니다. 주최자가 확인해 주세요.');}
    if(event.extendedProperties?.private?.moaBookingId!==booking.id)throw new CalendarError('캘린더 일정 식별자가 충돌했습니다.');
    if(!cancelled){
      // Events created before the link existed get it added once; a failed patch never fails the sync.
      if(booking.hostLink&&!String(event.description||'').includes(booking.hostLink))await call(`${base}/${id}?sendUpdates=none`,{method:'PATCH',body:JSON.stringify({description:describe(booking)})}).catch(()=>null);
      return {meetUrl:meetLink(event)};
    }
    const deleted=await call(`${base}/${id}?sendUpdates=none`,{method:'DELETE'});
    if(!deleted.ok&&![404,410].includes(deleted.status))throw new CalendarError('캘린더 일정 취소를 다시 시도해 주세요.');
    return {};
  }
  if(![404,410].includes(existing.status))throw new CalendarError('주최자의 캘린더 쓰기 권한을 확인하고 Google을 다시 연결해 주세요.');
  if(cancelled)return {};
  const start=new Date(`${booking.day}T${booking.time}:00+09:00`);
  const event={id,summary:displayMeeting(booking),description:describe(booking),start:{dateTime:start.toISOString(),timeZone:'Asia/Seoul'},end:{dateTime:new Date(start.getTime()+booking.duration*60000).toISOString(),timeZone:'Asia/Seoul'},extendedProperties:{private:{moaBookingId:booking.id}}};
  const online=booking.meetingMode!=='offline';
  // requestId = booking id, so a retried insert reuses the same conference instead of creating another.
  const withMeet={...event,conferenceData:{createRequest:{requestId:booking.id,conferenceSolutionKey:{type:'hangoutsMeet'}}}};
  let inserted=await call(base+'?sendUpdates=none'+(online?'&conferenceDataVersion=1':''),{method:'POST',body:JSON.stringify(online?withMeet:event)});
  if(online&&[400,403].includes(inserted.status))inserted=await call(base+'?sendUpdates=none',{method:'POST',body:JSON.stringify(event)});
  if(inserted.status===409){
    const retry=await call(`${base}/${id}`);const found=retry.ok?await retry.json():null;
    if(found?.status!=='cancelled'&&found?.extendedProperties?.private?.moaBookingId===booking.id)return {meetUrl:meetLink(found)};
  }
  if(!inserted.ok)throw new CalendarError('예약은 저장되었지만 주최자의 Google 캘린더 등록을 다시 시도해야 합니다.');
  const created=await inserted.json().catch(()=>null);
  return {meetUrl:meetLink(created)};
}
