import {after} from 'next/server';
import {adminClient} from '@/lib/supabase/server';
import {managementBooking,managementToken} from '@/lib/bookings/manage-token';
import {loadOwner,validDay} from '@/lib/bookings/server';
import {monthSlots} from '@/lib/availability';
import {syncBooking} from '@/lib/calendar/sync';
import {notificationMode} from '@/lib/notifications/providers';
import {processNotifications} from '@/lib/notifications/worker';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
const json=(b:unknown,s=200)=>Response.json(b,{status:s,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'}});
async function authorized(request:Request){
 const id=managementBooking((request.headers.get('authorization')||'').replace(/^Bearer /,''));
 if(!id)return null;
 const {data,error}=await adminClient().from('moa_bookings').select('id,owner_id,payload,status,starts_at,ends_at,replaced_by').eq('id',id).maybeSingle();
 if(error)throw Error('storage');
 if(!data||Date.now()>Date.parse(data.ends_at)+30*86400000)return null;
 return data;
}
export async function GET(request:Request){
 try{
  const initial=await authorized(request);if(!initial)return json({error:'예약 관리 링크가 유효하지 않거나 만료되었습니다.'},401);
  let booking:NonNullable<Awaited<ReturnType<typeof authorized>>>=initial;
  // Old confirmation links continue to reach the latest replacement.
  for(let i=0;booking.replaced_by&&i<100;i++){
   const {data,error}=await adminClient().from('moa_bookings').select('id,owner_id,payload,status,starts_at,ends_at,replaced_by').eq('id',booking.replaced_by).eq('owner_id',booking.owner_id).single();
   if(error||!data)throw Error();booking=data as NonNullable<Awaited<ReturnType<typeof authorized>>>;
  }
  if(booking.replaced_by)throw Error();
  const month=new URL(request.url).searchParams.get('month')||booking.payload.day.slice(0,7);
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return json({error:'월을 확인해 주세요.'},400);
  const canManage=booking.status==='confirmed'&&Date.parse(booking.starts_at)>Date.now();
  const owner=await loadOwner(booking.owner_id),event=owner.state.events.find(e=>e.id===booking.payload.eventId&&e.active);
  return json({booking:{title:booking.payload.title,name:booking.payload.name,day:booking.payload.day,time:booking.payload.time,duration:booking.payload.duration,status:booking.status},canManage,canReschedule:canManage&&!!event?.availability,days:canManage&&event?monthSlots(event.availability,month,event.duration,owner.busy):{},token:managementToken(booking.id)});
 }catch{return json({error:'예약 정보를 불러오지 못했습니다. 다시 시도해 주세요.'},503)}
}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'허용되지 않은 요청입니다.'},403);
 try{
  const booking=await authorized(request);if(!booking)return json({error:'유효한 예약 관리 링크가 필요합니다.'},401);
  const text=await request.text();if(text.length>2000)return json({error:'잘못된 요청입니다.'},400);
  let body;try{body=JSON.parse(text)}catch{return json({error:'입력을 확인해 주세요.'},400)}
  if(!body||!['cancel','reschedule'].includes(body.action))return json({error:'요청을 확인해 주세요.'},400);
  if(body.action==='reschedule'&&(!validDay(body.day||'')||!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time||'')||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestId||'')))return json({error:'변경할 날짜와 시간을 선택해 주세요.'},400);
  const db=adminClient();
  const {data:id,error}=await db.rpc('moa_manage_booking',{p_booking:booking.id,p_action:body.action,p_new_id:body.action==='reschedule'?body.requestId:null,p_day:body.day||null,p_time:body.time||null,p_mode:notificationMode()});
  if(error){const messages:Record<string,string>={booking_started:'이미 시작된 예약은 변경·취소할 수 없습니다.',booking_changed:'예약이 이미 변경되었습니다. 최신 예약을 다시 확인해 주세요.',booking_cancelled:'이미 취소된 예약입니다.',same_time:'현재 예약과 다른 시간을 선택해 주세요.',invalid_event:'주최자가 이 페이지의 예약을 중지했습니다. 취소는 가능합니다.',invalid_time:'해당 시간은 예약할 수 없습니다. 다른 시간을 선택해 주세요.',overlapping_booking:'다른 사람이 먼저 예약했습니다. 기존 예약은 유지됩니다.'};const key=Object.keys(messages).find(k=>error.message.includes(k));return json({error:key?messages[key]:'예약이 변경됐거나 처리하지 못했습니다. 다시 확인해 주세요.'},409)}
  after(async()=>{
   await Promise.allSettled([processNotifications(booking.owner_id),(async()=>{await syncBooking(booking.owner_id,booking.id);if(id!==booking.id)await syncBooking(booking.owner_id,id)})()]);
  });
  return json({ok:true,token:managementToken(id),status:body.action==='cancel'?'cancelled':'confirmed'});
 }catch{return json({error:'예약을 처리하지 못했습니다. 다시 시도해 주세요.'},503)}
}
