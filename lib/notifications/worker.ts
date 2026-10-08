import 'server-only';
import {adminClient} from '@/lib/supabase/server';
import {type NoticeJob} from './providers';
import {processClaimed} from './process';
export async function processNotifications(owner?:string){
  const db=adminClient();
  const {data,error}=await db.rpc('moa_claim_notifications',{p_limit:6,p_owner:owner||null});
  if(error)throw new Error('알림 발송 대기열을 불러오지 못했습니다.');
  const results=await processClaimed(db,(data||[]) as NoticeJob[]);
  for(const r of results)if(r.error)console.error('notification_job_incomplete',r.id,r.status);
  return results;
}
