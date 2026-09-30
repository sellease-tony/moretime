import 'server-only';
import {currentCalendarConstraints} from '@/lib/calendar/availability-sync';
import {overlaps} from '@/lib/calendar/google';
import {addDays,kstDay} from '@/lib/availability';
export async function checkCandidates(owner:string,candidates:string[],duration:number,mode:string){
 const constraints=await currentCalendarConstraints(owner),today=kstDay();
 for(const slot of candidates){const day=slot.slice(0,10),start=new Date(slot+':00+09:00'),end=new Date(+start+duration*60000);
 if(start<=new Date()||day<today||day>addDays(today,90)||overlaps(start.toISOString(),end.toISOString(),constraints.busy,mode==='offline'?60:0))throw Error('후보 시간에 기존 일정이나 이동시간이 겹칩니다. 일정을 다시 확인해 주세요.');}
}
export const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'}});
export const sameOrigin=(r:Request)=>r.headers.get('origin')===new URL(r.url).origin;
