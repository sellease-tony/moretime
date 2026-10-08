import type {SupabaseClient} from '@supabase/supabase-js';
import {defaultReminders,isReminder,reminderCanSend} from './reminders';
import {deliver,type NoticeJob} from './providers';
type Outcome={id:string;status:string;error?:string};
// SMS and Kakao are not offered yet; older bookings may still carry those channels, so never contact SOLAPI for them.
export const OFFERED_CHANNELS:readonly NoticeJob['channel'][]=['email'];
// Each job settles on its own: one failure never strands the rest of the batch in processing.
export async function processClaimed(db:SupabaseClient,jobs:NoticeJob[],send:typeof deliver=deliver):Promise<Outcome[]>{
  return Promise.all(jobs.map(job=>processJob(db,job,send)));
}
async function processJob(db:SupabaseClient,job:NoticeJob,send:typeof deliver):Promise<Outcome>{
  let skip:boolean;
  try{
    // A cancellation may supersede a claimed confirmation before a provider call begins.
    const {data:booking,error:readError}=await db.from('moa_bookings').select('status,starts_at').eq('id',job.booking_id).single();
    if(readError)throw new Error('예약 상태를 확인하지 못했습니다.');
    skip=job.event_type==='confirmed'&&booking?.status==='cancelled';
    if(isReminder(job.event_type)){
      const {data:settings,error:settingsError}=await db.from('moa_reminder_settings').select('reminder_24h,reminder_1h,guest,host').eq('owner_id',job.owner_id).maybeSingle();
      if(settingsError)throw Error('리마인더 설정을 확인하지 못했습니다.');
      skip=!booking||!reminderCanSend(job,booking,settings||defaultReminders);
    }
  }catch(e){
    // No provider was contacted yet, so returning the job to the queue is always safe (even for SMS/Kakao).
    const error=e instanceof Error?e.message:'발송 전 확인에 실패했습니다.';
    await db.from('moa_notification_jobs').update({status:'pending',last_error:error,available_at:new Date(Date.now()+60_000).toISOString(),lease_until:null,lease_token:null,updated_at:new Date().toISOString()}).eq('id',job.id).eq('lease_token',job.lease_token).eq('status','processing');
    return {id:job.id,status:'released',error};
  }
  const outcome=skip?{status:'superseded' as const}:!OFFERED_CHANNELS.includes(job.channel)?{status:'blocked' as const,error:'문자·카카오 알림톡은 아직 제공하지 않습니다.'}:await send(job);
  const retry=outcome.status==='retry'&&job.attempts<3&&Date.now()+5*60_000<new Date(job.expires_at).getTime();
  const status=outcome.status==='retry'?(retry?'pending':'failed'):outcome.status;
  const {error:updateError}=await db.from('moa_notification_jobs').update({status,provider_id:'providerId' in outcome?outcome.providerId:null,last_error:'error' in outcome?outcome.error:null,available_at:new Date(Date.now()+job.attempts*60_000).toISOString(),lease_until:null,lease_token:null,updated_at:new Date().toISOString()}).eq('id',job.id).eq('lease_token',job.lease_token).eq('status','processing');
  // The provider already accepted or rejected the message; the lease expiry rules decide what happens next.
  if(updateError)return {id:job.id,status:'unrecorded',error:'알림 처리 결과를 기록하지 못했습니다.'};
  return {id:job.id,status};
}
