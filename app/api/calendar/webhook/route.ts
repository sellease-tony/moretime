import {after} from 'next/server';
import {adminClient} from '@/lib/supabase/server';
import {validChannel} from '@/lib/calendar/channel-auth';
import {processCalendarJob} from '@/lib/calendar/background';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:Request){
 const id=request.headers.get('x-goog-channel-id')||'';
 if(!/^[0-9a-f-]{36}$/i.test(id))return new Response(null,{status:403});
 try{
  const db=adminClient();
  const {data,error}=await db.from('moa_calendar_channels').select('owner_id,token_hash,resource_id,expires_at').eq('id',id).maybeSingle();
  if(error)throw Error();
  if(!data||!validChannel(request.headers,data))return new Response(null,{status:403});
  // Persist before acknowledging. Cron recovers if the background invocation stops.
  const {error:queueError}=await db.rpc('moa_enqueue_calendar',{p_owner:data.owner_id});
  if(queueError)throw Error();
  after(async()=>{try{await processCalendarJob()}catch{console.error('calendar_webhook_worker_failed')}});
  return new Response(null,{status:204});
 }catch{return new Response(null,{status:503})}
}
