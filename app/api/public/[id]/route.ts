import {managementUrl} from '@/lib/bookings/manage-token';
import {guestContactSchema} from '@/lib/bookings/guest';
import {monthSlots,savedSlots,kstDay} from '@/lib/availability';
import {syncBooking} from '@/lib/calendar/sync';
import {after} from 'next/server';
import {currentUser,adminClient,supabaseConfigured} from '@/lib/supabase/server';
import {loadOwner,slotsFor,validDay} from '@/lib/bookings/server';
import {bookingSchema} from '@/lib/workspace';
import {processNotifications} from '@/lib/notifications/worker';
import {notificationMode} from '@/lib/notifications/providers';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
type Context={params:Promise<{id:string}>};
const json=(b:unknown,s=200)=>Response.json(b,{status:s,headers:{'Cache-Control':'private, no-store'}});
async function link(id:string){if(!/^[a-f0-9-]{36}$/.test(id))return null;const {data,error}=await adminClient().from('moa_public_links').select('owner_id,event_id').eq('id',id).maybeSingle();if(error)throw Error('저장소 연결을 확인해 주세요.');return data}
export async function GET(request:Request,context:Context){
  if(!supabaseConfigured())return json({error:'서비스 연결 설정이 필요합니다.'},503);
  try{
    const target=await link((await context.params).id);if(!target)return json({error:'예약 페이지를 찾을 수 없습니다.'},404);
    const owner=await loadOwner(target.owner_id),event=owner.state.events.find(e=>e.id===target.event_id&&e.active);if(!event)return json({error:'현재 예약을 받고 있지 않습니다.'},404);
    const day=new URL(request.url).searchParams.get('day');let slots:string[]=[];
    if(day){if(!validDay(day))return json({error:'오늘부터 90일 이내의 날짜를 선택해 주세요.'},400);slots=savedSlots(event.availability,day,event.duration,owner.busy)}
    const month=new URL(request.url).searchParams.get('month')||kstDay().slice(0,7);
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return json({error:'월을 확인해 주세요.'},400);
    const days=monthSlots(event.availability,month,event.duration,owner.busy);
    const user=await currentUser();
    return json({event:{title:event.title,desc:event.desc,duration:event.duration},slots,days,availabilityReady:!!event.availability,mode:notificationMode(),user:user?{name:user.user_metadata.full_name||user.email,email:user.email}:null});
  }catch(e){return json({error:e instanceof Error?e.message:'예약 페이지를 불러오지 못했습니다.'},503)}
}
export async function POST(request:Request,context:Context){
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'허용되지 않은 요청입니다.'},403);
  if(!supabaseConfigured())return json({error:'서비스 연결 설정이 필요합니다.'},503);
  try{
    const target=await link((await context.params).id);if(!target)return json({error:'예약 페이지를 찾을 수 없습니다.'},404);
    const text=await request.text();if(text.length>5000)return json({error:'요청이 너무 큽니다.'},413);
    let body;try{body=JSON.parse(text)}catch{return json({error:'입력값을 확인해 주세요.'},400)}
    const contact=guestContactSchema.safeParse(body);
    if(!contact.success)return json({error:contact.error.issues[0].message},400);
    const {name,email,phone}=contact.data;
    if(typeof body.id!=='string'||! /^[a-f0-9-]{36}$/.test(body.id))return json({error:'예약 요청 ID를 확인해 주세요.'},400);
    const {data:existing,error:existingError}=await adminClient().from('moa_bookings').select('payload,status').eq('id',body.id).eq('owner_id',target.owner_id).maybeSingle();
    if(existingError)throw Error('기존 예약 요청을 확인하지 못했습니다.');
    if(existing){
      if(existing.status==='confirmed'&&existing.payload.email===email&&existing.payload.eventId===target.event_id&&existing.payload.name===name&&existing.payload.phone===phone&&existing.payload.day===body.day&&existing.payload.time===body.time){after(async()=>{await syncBooking(target.owner_id,body.id)});return json({ok:true,id:body.id,manageUrl:managementUrl(body.id),mode:notificationMode(),calendar:{pending:true}});}
      return json({error:'이미 처리된 예약 요청입니다.'},409);
    }
    if(!validDay(body.day||''))return json({error:'예약 날짜를 확인해 주세요.'},400);
    // Read saved host slots; the workspace revision and overlap check protect the transaction.
    const {slots,event,data}=await slotsFor(target.owner_id,target.event_id,body.day);
    if(!slots.includes(body.time))return json({error:'해당 시간에 다른 일정이 있습니다. 다른 시간을 선택해 주세요.'},409);
    const parsed=bookingSchema.safeParse({id:body.id,eventId:event.id,title:event.title,duration:event.duration,day:body.day,time:body.time,name,email,phone,channels:[...new Set(['email',...(Array.isArray(body.channels)?body.channels:[])])],notificationConsent:body.notificationConsent===true});
    if(!parsed.success)return json({error:parsed.error.issues[0].message},400);
    const booking=parsed.data;
    const db=adminClient();
    // Apply the same daily recipient limit for guests and signed-in visitors.
    const {count,error:limitError}=await db.from('moa_bookings').select('id',{head:true,count:'exact'}).eq('payload->>email',email).gte('created_at',new Date(Date.now()-86400000).toISOString());
    if(limitError)throw Error('예약 제한을 확인하지 못했습니다.');if((count||0)>=20)return json({error:'하루 예약 가능 횟수를 초과했습니다.'},429);
    const {error}=await db.rpc('moa_save_workspace',{p_owner:target.owner_id,p_revision:data.revision,p_state:data.state,p_bookings:[...data.bookings,booking],p_mode:notificationMode()});
    if(error)return json({error:'예약 가능한 시간이 변경되었습니다. 새로고침 후 다시 선택해 주세요.'},409);
    after(async()=>{await Promise.allSettled([syncBooking(target.owner_id,booking.id),processNotifications(target.owner_id)])});
    return json({ok:true,id:booking.id,mode:notificationMode(),calendar:{pending:true}});
  }catch(e){return json({error:e instanceof Error?e.message:'예약하지 못했습니다.'},503)}
}
