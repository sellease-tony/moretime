import 'server-only';
import {adminClient} from '@/lib/supabase/server';
import {deliver,type NoticeJob} from './providers';
export async function processNotifications(owner?:string){
  const db=adminClient();
  const {data,error}=await db.rpc('moa_claim_notifications',{p_limit:6,p_owner:owner||null});
  if(error)throw new Error('알림 발송 대기열을 불러오지 못했습니다.');
  const jobs=(data||[]) as NoticeJob[];
  const results=await Promise.all(jobs.map(async job=>{
    // A cancellation may supersede a claimed confirmation before a provider call begins.
    const {data:booking,error:readError}=await db.from('moa_bookings').select('status').eq('id',job.booking_id).single();
    if(readError)throw new Error('예약 상태를 확인하지 못했습니다.');
    const outcome=job.event_type==='confirmed'&&booking?.status==='cancelled'?{status:'superseded' as const}:await deliver(job);
    const retry=outcome.status==='retry'&&job.attempts<3&&Date.now()+5*60_000<new Date(job.expires_at).getTime();
    const status=outcome.status==='retry'?(retry?'pending':'failed'):outcome.status;
    const {error:updateError}=await db.from('moa_notification_jobs').update({status,provider_id:'providerId' in outcome?outcome.providerId:null,last_error:'error' in outcome?outcome.error:null,available_at:new Date(Date.now()+job.attempts*60_000).toISOString(),lease_until:null,lease_token:null,updated_at:new Date().toISOString()}).eq('id',job.id).eq('lease_token',job.lease_token).eq('status','processing');
    if(updateError)throw new Error('알림 처리 결과를 기록하지 못했습니다.');
    return {id:job.id,status};
  }));
  return results;
}
