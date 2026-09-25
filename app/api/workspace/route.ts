import {syncOwnerAvailability,currentCalendarBusy} from '@/lib/calendar/availability-sync';
import {applyCalendarBusy} from '@/lib/calendar/availability-state';
import {syncBooking} from '@/lib/calendar/sync';
import {after} from 'next/server';
import {currentUser,adminClient,supabaseConfigured} from '@/lib/supabase/server';
import {defaultWorkspace,workspacePatch,validateNewBooking} from '@/lib/workspace';
import {integrationStatus,notificationMode} from '@/lib/notifications/providers';
import {processNotifications} from '@/lib/notifications/worker';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});

export async function GET(){
  if(!supabaseConfigured())return json({...defaultWorkspace,bookings:[],revision:0,setupRequired:true,user:null,notifications:{mode:'off'}});
  const user=await currentUser();
  if(!user)return json({...defaultWorkspace,bookings:[],revision:0,setupRequired:false,user:null,notifications:{mode:'off'}});
  try{
    await syncOwnerAvailability(user.id);
    const db=adminClient();
    const [{data:row,error},{data:bookings,error:bookingError}]=await Promise.all([
      db.from('moa_workspaces').select('data,revision').eq('owner_id',user.id).maybeSingle(),
      db.from('moa_bookings').select('payload').eq('owner_id',user.id).eq('status','confirmed').order('starts_at')
    ]);
    if(error||bookingError)throw Error();
    return json({...defaultWorkspace,...(row?.data||{}),bookings:(bookings||[]).map(b=>b.payload),revision:row?.revision||0,setupRequired:false,user:{name:user.user_metadata.full_name||user.email,email:user.email},serverNow:Date.now(),notifications:integrationStatus()});
  }catch{return json({error:'Supabase 테이블을 불러오지 못했습니다. SQL 마이그레이션과 환경변수를 확인해 주세요.'},503)}
}

export async function POST(request:Request){
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'허용되지 않은 요청입니다.'},403);
  if(!supabaseConfigured())return json({error:'Supabase 연결 설정이 필요합니다.'},503);
  const user=await currentUser();
  if(!user)return json({error:'Google 로그인 후 저장할 수 있습니다.'},401);
  let raw:unknown;
  try{const body=await request.text();if(body.length>250000)return json({error:'요청이 너무 큽니다.'},413);raw=JSON.parse(body)}catch{return json({error:'잘못된 요청입니다.'},400)}
  const parsed=workspacePatch.safeParse(raw);
  if(!parsed.success)return json({error:parsed.error.issues[0]?.message||'입력을 확인해 주세요.'},400);
  try{
    const {revision,...changes}=parsed.data,db=adminClient();
    const [{data:row,error},{data:oldBookings,error:bookingsError}]=await Promise.all([
      db.from('moa_workspaces').select('data,revision').eq('owner_id',user.id).maybeSingle(),
      db.from('moa_bookings').select('payload').eq('owner_id',user.id).eq('status','confirmed')
    ]);
    if(error||bookingsError)throw Error('storage');
    if((row?.revision||0)!==revision)return json({error:'다른 변경사항이 있습니다. 새로고침 후 다시 시도해 주세요.'},409);
    const old=(oldBookings||[]).map(r=>r.payload),bookings=changes.bookings||old;
    let state={...defaultWorkspace,...(row?.data||{}),...changes};delete state.bookings;
    if(changes.events){try{state=applyCalendarBusy(state,await currentCalendarBusy(user.id))}catch{return json({error:'Google 캘린더를 확인하지 못했습니다. 다시 연결한 후 저장해 주세요.'},503)}}
    if(new Set(state.events.map((e:{id:string})=>e.id)).size!==state.events.length)return json({error:'예약 페이지 ID가 중복되었습니다.'},400);
    for(const b of bookings){if(!old.some(o=>o.id===b.id))try{
      validateNewBooking(b,state);

    }catch(e){return json({error:e instanceof Error?e.message:'예약할 수 없습니다.'},400)}}
    const {data:nextRevision,error:saveError}=await db.rpc('moa_save_workspace',{p_owner:user.id,p_revision:revision,p_state:state,p_bookings:bookings,p_mode:notificationMode()});
    if(saveError){const messages:Record<string,string>={stale_revision:'다른 변경사항이 있습니다. 새로고침해 주세요.',overlapping_booking:'이미 예약된 시간입니다.',immutable_booking:'기존 예약은 직접 수정할 수 없습니다. 취소 후 다시 예약해 주세요.',invalid_time:'예약할 수 없는 시간입니다.',invalid_event:'예약 페이지가 변경되었습니다.',duplicate_booking:'중복된 예약입니다.'};const key=Object.keys(messages).find(k=>saveError.message.includes(k));return json({error:key?messages[key]:'예약을 저장하지 못했습니다. Supabase 설정을 확인해 주세요.'},key?409:503)}
    after(async()=>{try{await processNotifications(user.id)}catch{console.error('notification_queue_processing_failed')}});
    const changed=[...bookings.filter(b=>!old.some(o=>o.id===b.id)),...old.filter(o=>!bookings.some(b=>b.id===o.id))];
    const calendar=await Promise.all(changed.map(b=>syncBooking(user.id,b.id)));
    return json({ok:true,revision:nextRevision,events:state.events,calendarSync:state.calendarSync,notificationMode:notificationMode(),calendarPending:calendar.some(r=>!r.synced)});
  }catch{return json({error:'Supabase 저장소에 연결하지 못했습니다.'},503)}
}
