import {after} from 'next/server';
import {adminClient,currentUser} from '@/lib/supabase/server';
import {ownerBusy} from '@/lib/calendar/server';
import {syncBooking} from '@/lib/calendar/sync';
import {processNotifications} from '@/lib/notifications/worker';
import {notificationMode} from '@/lib/notifications/providers';
import {meetingRange} from '@/lib/bookings/calendar-links';
import {googleConflict,rescheduleError} from '@/lib/bookings/reschedule';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
type Context={params:Promise<{id:string}>};
const json=(b:unknown,s=200)=>Response.json(b,{status:s,headers:{'Cache-Control':'private, no-store'}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Host moves one of their confirmed bookings to another time; both parties get a "changed" email.
export async function POST(request:Request,ctx:Context){
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'허용되지 않은 요청입니다.'},403);
 const user=await currentUser();if(!user)return json({error:'로그인이 필요합니다.'},401);
 const {id}=await ctx.params;if(!uuid.test(id))return json({error:'예약을 찾을 수 없습니다.'},404);
 let body;try{body=JSON.parse((await request.text()).slice(0,2000))}catch{return json({error:'입력을 확인해 주세요.'},400)}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(body?.day||'')||!/^([01]\d|2[0-3]):[0-5]\d$/.test(body?.time||'')||!uuid.test(body?.requestId||''))return json({error:'변경할 날짜와 시간을 입력해 주세요.'},400);
 const db=adminClient();
 const {data:booking,error:readError}=await db.from('moa_bookings').select('payload,status').eq('id',id).eq('owner_id',user.id).maybeSingle();
 if(readError)return json({error:'예약을 불러오지 못했습니다.'},503);
 if(!booking)return json({error:'예약을 찾을 수 없습니다.'},404);
 // The host may pick a time outside the open slots, so warn (not block) when Google shows them busy.
 if(body.force!==true&&booking.status==='confirmed'){
  const next={day:body.day,time:body.time,duration:booking.payload.duration},{start,end}=meetingRange(next);
  try{
   const busy=await ownerBusy(user.id,new Date(start.getTime()-3600e3).toISOString(),new Date(end.getTime()+3600e3).toISOString());
   if(googleConflict(busy,next,booking.payload,booking.payload.meetingMode==='offline'?60:0))return json({warning:'Google 캘린더의 다른 일정과 겹칩니다. 그래도 변경할까요?',code:'calendar_conflict'},409);
  }catch{return json({warning:'Google 캘린더를 확인하지 못했습니다. 일정 겹침을 확인하지 않고 변경할까요?',code:'calendar_unavailable'},409)}
 }
 const {data:newId,error}=await db.rpc('moa_host_reschedule',{p_owner:user.id,p_booking:id,p_new_id:body.requestId,p_day:body.day,p_time:body.time,p_mode:notificationMode()});
 if(error)return json({error:rescheduleError(error.message)},409);
 // Calendar first so the change email carries the new booking's Meet link.
 after(async()=>{await syncBooking(user.id,id);await syncBooking(user.id,newId);await processNotifications(user.id).catch(()=>{})});
 return json({ok:true,id:newId,mode:notificationMode()});
}
