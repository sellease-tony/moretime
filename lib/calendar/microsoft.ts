import {CalendarError,type Busy} from './google';
import {describeBooking,type CalendarBooking} from './events';
import {displayMeeting} from '../bookings/meeting';

const GRAPH='https://graph.microsoft.com/v1.0';
const DAY=86400000;
type GraphTime={dateTime:string;timeZone:string};
type GraphEvent={id?:string;start?:GraphTime;end?:GraphTime;showAs?:string;isCancelled?:boolean;onlineMeeting?:{joinUrl?:string}|null};
// Times are requested in UTC (Prefer header) and come back without a zone suffix.
const utc=(t?:GraphTime)=>t?.dateTime?Date.parse(t.dateTime.endsWith('Z')?t.dateTime:t.dateTime+'Z'):NaN;
const call=(fetcher:typeof fetch,access:string,url:string,init:RequestInit={})=>fetcher(url,{...init,headers:{Authorization:`Bearer ${access}`,'Content-Type':'application/json',Prefer:'outlook.timezone="UTC"',...(init.headers||{})},signal:AbortSignal.timeout(10000),cache:'no-store'});

// Busy spans from the default Outlook calendar. Free and "working elsewhere" entries do not block bookings.
export async function queryMicrosoftBusy(access:string,start:string,end:string,fetcher:typeof fetch=fetch):Promise<Busy[]>{
 const from=Date.parse(start),to=Date.parse(end);
 if(!Number.isFinite(from)||!Number.isFinite(to)||to<=from)throw new CalendarError('조회 기간을 확인해 주세요.');
 const busy:Busy[]=[];
 for(let w=from;w<to;w+=31*DAY){
  let url:string|undefined=`${GRAPH}/me/calendarView?`+new URLSearchParams({startDateTime:new Date(w).toISOString(),endDateTime:new Date(Math.min(to,w+31*DAY)).toISOString(),$select:'start,end,showAs,isCancelled',$top:'500'});
  for(let pages=0;url;pages++){
   if(pages>20)throw new CalendarError('Outlook 일정이 너무 많아 확인하지 못했습니다.');
   const r=await call(fetcher,access,url);
   if(!r.ok)throw new CalendarError('Outlook 일정 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.');
   const d=await r.json() as {value?:GraphEvent[];'@odata.nextLink'?:string};
   if(!Array.isArray(d.value))throw new CalendarError('Outlook 일정을 확인하지 못했습니다.');
   for(const e of d.value){
    if(e.isCancelled||e.showAs==='free'||e.showAs==='workingElsewhere')continue;
    const s=utc(e.start),en=utc(e.end);
    if(!Number.isFinite(s)||!Number.isFinite(en)||s>=en)throw new CalendarError('Outlook 일정 시간 정보를 확인하지 못했습니다.');
    busy.push({start:new Date(s).toISOString(),end:new Date(en).toISOString()});
   }
   url=d['@odata.nextLink'];
  }
 }
 return busy;
}

const eventBody=(b:CalendarBooking,online:boolean)=>{
 const start=new Date(`${b.day}T${b.time}:00+09:00`),end=new Date(start.getTime()+b.duration*60000);
 const iso=(d:Date)=>d.toISOString().slice(0,19);
 return {subject:displayMeeting(b),body:{contentType:'text',content:describeBooking(b)},start:{dateTime:iso(start),timeZone:'UTC'},end:{dateTime:iso(end),timeZone:'UTC'},
  // transactionId makes a retried create return the same event instead of a duplicate.
  transactionId:b.id,...(online?{isOnlineMeeting:true,onlineMeetingProvider:'teamsForBusiness'}:{})};
};

// Mirrors syncGoogleEvent for Outlook. Online bookings get a Teams link where the account supports it (work/school);
// personal Outlook.com accounts cannot create Teams meetings, so the event is created without one.
export async function syncMicrosoftEvent(access:string,b:CalendarBooking,cancelled:boolean,eventId:string|null,fetcher:typeof fetch=fetch):Promise<{eventId:string|null;meetUrl?:string}>{
 if(cancelled){
  if(!eventId)return {eventId:null};
  const r=await call(fetcher,access,`${GRAPH}/me/events/${encodeURIComponent(eventId)}`,{method:'DELETE'});
  if(!r.ok&&r.status!==404&&r.status!==410)throw new CalendarError('Outlook 일정을 삭제하지 못했습니다.');
  return {eventId:null};
 }
 if(eventId){
  const r=await call(fetcher,access,`${GRAPH}/me/events/${encodeURIComponent(eventId)}?$select=id,onlineMeeting`);
  if(r.ok){const e=await r.json() as GraphEvent;return {eventId,meetUrl:e.onlineMeeting?.joinUrl||undefined}}
  if(r.status!==404)throw new CalendarError('Outlook 일정을 확인하지 못했습니다.');
 }
 const online=b.meetingMode!=='offline';
 let r=await call(fetcher,access,`${GRAPH}/me/events`,{method:'POST',body:JSON.stringify(eventBody(b,online))});
 if(!r.ok&&online&&r.status===400)r=await call(fetcher,access,`${GRAPH}/me/events`,{method:'POST',body:JSON.stringify(eventBody(b,false))});
 if(!r.ok)throw new CalendarError('Outlook 일정을 만들지 못했습니다.');
 const e=await r.json() as GraphEvent;
 if(!e.id)throw new CalendarError('Outlook 일정 응답을 확인하지 못했습니다.');
 return {eventId:e.id,meetUrl:e.onlineMeeting?.joinUrl||undefined};
}
