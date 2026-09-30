import {after} from 'next/server';
import {adminClient,currentUser} from '@/lib/supabase/server';
import {json,sameOrigin,checkCandidates} from '@/lib/polls/server';
import {pollSchema} from '@/lib/polls/model';
import {notificationMode} from '@/lib/notifications/providers';
import {processNotifications} from '@/lib/notifications/worker';
import {syncBooking} from '@/lib/calendar/sync';
export const maxDuration=60;
type Context={params:Promise<{id:string}>};
export async function GET(_r:Request,ctx:Context){const user=await currentUser();if(!user)return json({error:'로그인이 필요합니다.'},401);const db=adminClient(),{id}=await ctx.params;const {data:p,error}=await db.from('moa_polls').select('*').eq('id',id).eq('owner_id',user.id).maybeSingle();if(error||!p)return json({error:'투표를 찾을 수 없습니다.'},404);const {data:responses,error:re}=await db.from('moa_poll_responses').select('id,name,email,choices').eq('poll_id',id).order('updated_at');return re?json({error:'응답 조회 실패'},503):json({poll:{...p,responses}})}
export async function PATCH(request:Request,ctx:Context){if(!sameOrigin(request))return json({error:'허용되지 않은 요청입니다.'},403);const user=await currentUser();if(!user)return json({error:'로그인이 필요합니다.'},401);try{
 const text=await request.text();if(text.length>20000)return json({error:'요청이 너무 큽니다.'},400);const body=JSON.parse(text),{id}=await ctx.params,db=adminClient();
 const {data:p,error}=await db.from('moa_polls').select('*').eq('id',id).eq('owner_id',user.id).maybeSingle();if(error||!p)return json({error:'투표를 찾을 수 없습니다.'},404);
 if(body.action==='confirm'){
  if(p.status==='confirmed'&&p.selected_slot===body.slot)return json({ok:true});
  if(p.status!=='open'||body.revision!==p.revision||!p.candidates.includes(body.slot))return json({error:'응답이 변경되었습니다. 새로고침해 주세요.'},409);
  const {data:w,error:we}=await db.from('moa_workspaces').select('revision').eq('owner_id',user.id).maybeSingle();if(we)throw Error('저장소 확인 실패');
  await checkCandidates(user.id,[body.slot],p.duration,p.meeting_mode);
  const {data:bid,error:ce}=await db.rpc('moa_confirm_poll',{p_poll:id,p_owner:user.id,p_revision:p.revision,p_workspace_revision:w?.revision||0,p_slot:body.slot,p_mode:notificationMode()});
  if(ce)return json({error:'확정하지 못했습니다. 예상 인원 전원이 응답했고 모두 가능한 시간인지, 다른 예약이 생겼는지 새로고침해 확인해 주세요.'},409);
  after(async()=>{await Promise.allSettled([syncBooking(user.id,bid),processNotifications(user.id)])});return json({ok:true});
 }
 if(body.action==='cancel'){
  if(p.status==='confirmed'){
   const {error:ce}=await db.rpc('moa_manage_booking',{p_booking:p.booking_id,p_action:'cancel',p_new_id:null,p_day:null,p_time:null,p_mode:notificationMode()});if(ce)throw Error('이미 시작된 모임은 취소할 수 없습니다.');
   after(async()=>{await Promise.allSettled([syncBooking(user.id,p.booking_id),processNotifications(user.id)])});
  }else {const {data:changed,error:ce}=await db.from('moa_polls').update({status:'cancelled',revision:p.revision+1}).eq('id',id).eq('owner_id',user.id).eq('revision',p.revision).select('id');if(ce||!changed?.length)throw Error('투표가 변경됐습니다. 새로고침 후 다시 시도해 주세요.');}
  return json({ok:true});
 }
 if(body.action==='add'){
  if(p.status!=='open'||body.revision!==p.revision)return json({error:'투표가 변경됐습니다. 새로고침해 주세요.'},409);
  const v=pollSchema.parse(body.poll);if(v.duration!==p.duration||v.meeting_mode!==p.meeting_mode)throw Error('응답을 보존하기 위해 소요시간과 미팅 방식은 변경할 수 없습니다. 새 투표를 만들어 주세요.');
  await checkCandidates(user.id,v.candidates,p.duration,p.meeting_mode);const candidates=[...new Set([...p.candidates,...v.candidates])].sort();if(candidates.length>200)throw Error('후보 시간은 최대 200개입니다.');
  const {data:updated,error:ue}=await db.from('moa_polls').update({candidates,revision:p.revision+1}).eq('id',id).eq('owner_id',user.id).eq('revision',p.revision).eq('status','open').select('id');if(ue||!updated?.length)throw Error('응답이 변경됐습니다. 새로고침해 주세요.');return json({ok:true});
 }
 return json({error:'잘못된 요청입니다.'},400);
 }catch(e){return json({error:e instanceof Error?e.message:'처리하지 못했습니다.'},400)}}
