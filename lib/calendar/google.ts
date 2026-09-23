export type Busy={start:string;end:string};
export class CalendarError extends Error{}
export async function queryGoogleBusy(accessToken:string,start:string,end:string,fetcher:typeof fetch=fetch):Promise<Busy[]>{
  // Selected calendars, including the primary calendar; paginate instead of silently ignoring others.
  let ids:string[]=[],page:string|undefined;
  do{
    const url=new URL('https://www.googleapis.com/calendar/v3/users/me/calendarList');url.searchParams.set('maxResults','250');if(page)url.searchParams.set('pageToken',page);
    const r=await fetcher(url,{headers:{Authorization:`Bearer ${accessToken}`},signal:AbortSignal.timeout(10000),cache:'no-store'});
    if(!r.ok)throw new CalendarError('Google 캘린더 연결을 확인해 주세요.');
    const d=await r.json() as {items?:{id:string;primary?:boolean;selected?:boolean;deleted?:boolean;hidden?:boolean}[];nextPageToken?:string};
    if(!Array.isArray(d.items))throw new CalendarError('캘린더 목록을 확인하지 못했습니다.');
    ids.push(...d.items.filter(c=>!c.deleted&&!c.hidden&&!c.id.endsWith('@group.v.calendar.google.com')&&(c.primary||c.selected)).map(c=>c.id));page=d.nextPageToken;
    if(ids.length>250)throw new CalendarError('조회할 캘린더가 너무 많습니다. Google Calendar에서 표시할 캘린더를 줄여주세요.');
  }while(page);
  ids=[...new Set(ids)];if(!ids.length)throw new CalendarError('조회 가능한 캘린더가 없습니다.');
  const busy:Busy[]=[];
  for(let i=0;i<ids.length;i+=50){
    const group=ids.slice(i,i+50);
    const r=await fetcher('https://www.googleapis.com/calendar/v3/freeBusy',{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({timeMin:start,timeMax:end,timeZone:'Asia/Seoul',items:group.map(id=>({id}))}),signal:AbortSignal.timeout(10000),cache:'no-store'});
    if(!r.ok)throw new CalendarError('Google 일정 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    const d=await r.json() as {calendars?:Record<string,{busy?:Busy[];errors?:unknown[]}>};
    for(const id of group){const c=d.calendars?.[id];if(!c||c.errors?.length||!Array.isArray(c.busy))throw new CalendarError('일부 캘린더 일정을 확인하지 못해 예약을 잠시 중지했습니다.');for(const span of c.busy){if(!Number.isFinite(Date.parse(span.start))||!Number.isFinite(Date.parse(span.end))||Date.parse(span.start)>=Date.parse(span.end))throw new CalendarError('캘린더 시간 정보를 확인하지 못했습니다.');busy.push(span)}}
  }
  return busy;
}
export function overlaps(start:string,end:string,busy:Busy[]){const s=Date.parse(start),e=Date.parse(end);return busy.some(b=>s<Date.parse(b.end)&&e>Date.parse(b.start))}
export function availableSlots(day:string,duration:number,hours:boolean[],range:string[],busy:Busy[],now=new Date()){
  if(!hours[new Date(day+'T12:00:00+09:00').getUTCDay()])return [];
  const minutes=(s:string)=>Number(s.slice(0,2))*60+Number(s.slice(3)),slots:string[]=[];
  for(let m=minutes(range[0]);m+duration<=minutes(range[1]);m+=30){
    const time=`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
    const start=new Date(day+'T'+time+':00+09:00'),end=new Date(start.getTime()+duration*60000);
    if(start>now&&!overlaps(start.toISOString(),end.toISOString(),busy))slots.push(time);
  }
  return slots;
}
