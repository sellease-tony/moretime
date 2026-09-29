import {addDays} from '../availability';
export const KOREAN_HOLIDAY_FEED='https://calendar.google.com/calendar/ical/en.south_korea%23holiday%40group.v.calendar.google.com/public/basic.ics';
// This Google feed explicitly distinguishes Public holiday from Observance.
// It uses DATE-only entries with exclusive DTEND, including substitute holidays.
export function parseKoreanHolidays(ics:string,start:string,end:string){
 if(!ics.includes('BEGIN:VCALENDAR')||!ics.includes('END:VCALENDAR'))throw Error('공휴일 데이터를 확인하지 못했습니다.');
 const result:Record<string,string>={};const covered=new Set<string>();
 const unfolded=ics.replace(/\r?\n[ \t]/g,'');
 for(const block of unfolded.split('BEGIN:VEVENT').slice(1)){
  if(/^STATUS:CANCELLED\r?$/m.test(block)||!/^DESCRIPTION:Public holiday(?:\\n[^\r\n]*)?\r?$/m.test(block))continue;
  const date=(key:string)=>{const v=block.match(new RegExp('^'+key+';VALUE=DATE:(\\d{4})(\\d{2})(\\d{2})\\r?$','m'));return v?`${v[1]}-${v[2]}-${v[3]}`:''};
  const from=date('DTSTART'),to=date('DTEND');if(!from||!to||to<=from)throw Error('공휴일 날짜를 확인하지 못했습니다.');
  covered.add(from.slice(0,4));const name=block.match(/^SUMMARY:(.*)\r?$/m)?.[1]?.trim()||'대한민국 공휴일';
  for(let day=from;day<to;day=addDays(day,1))if(day>=start&&day<=end)result[day]=name;
 }
 for(let year=Number(start.slice(0,4));year<=Number(end.slice(0,4));year++)if(!covered.has(String(year)))throw Error('해당 연도의 공휴일 정보를 확인하지 못했습니다.');
 return result;
}
export async function koreanHolidays(start:string,end:string,fetcher:typeof fetch=fetch){
 const r=await fetcher(KOREAN_HOLIDAY_FEED,{signal:AbortSignal.timeout(10000),next:{revalidate:21600}});
 if(!r.ok)throw Error('대한민국 공휴일 정보를 가져오지 못했습니다.');
 return parseKoreanHolidays(await r.text(),start,end);
}
