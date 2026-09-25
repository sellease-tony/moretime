import 'server-only';
import {randomBytes,randomUUID} from 'node:crypto';
import {adminClient} from '@/lib/supabase/server';
import {ownerAccessToken} from './server';
import {selectedCalendarIds} from './google';
import {channelTokenHash} from './channel-auth';
import {syncOwnerAvailability} from './availability-sync';

export async function renewCalendarChannels(owner:string){
 const origin=process.env.APP_URL;
 if(!origin||!origin.startsWith('https://'))throw Error('HTTPS APP_URL required');
 const db=adminClient(),access=await ownerAccessToken(owner),ids=await selectedCalendarIds(access);
 const {data:channels,error}=await db.from('moa_calendar_channels').select('*').eq('owner_id',owner);
 if(error)throw Error('Channel storage unavailable');
 let created=0;
 for(const calendar of ids){
  if(channels?.some(c=>c.calendar_id===calendar&&c.resource_id&&Date.parse(c.expires_at)>Date.now()+86400000))continue;
  // Bound work per invocation; remaining calendars are picked up by the next job.
  if(created>=5)throw Error('More subscriptions pending');
  const id=randomUUID(),token=randomBytes(32).toString('hex');
  const {error:insertError}=await db.from('moa_calendar_channels').insert({id,owner_id:owner,calendar_id:calendar,token_hash:channelTokenHash(token),expires_at:new Date(Date.now()+120000).toISOString()});
  if(insertError)throw Error('Channel creation failed');
  const response=await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar)}/events/watch`,{
   method:'POST',headers:{Authorization:`Bearer ${access}`,'Content-Type':'application/json'},
   body:JSON.stringify({id,token,type:'web_hook',address:new URL('/api/calendar/webhook',origin).href,params:{ttl:'604800'}}),
   signal:AbortSignal.timeout(10000),cache:'no-store'
  });
  if(!response.ok)throw Error('Calendar subscription failed');
  const result=await response.json() as {resourceId?:string;expiration?:string};
  const expiry=Number(result.expiration);
  if(!result.resourceId||!Number.isFinite(expiry)||expiry<=Date.now())throw Error('Invalid subscription response');
  const {error:saveError}=await db.from('moa_calendar_channels').update({resource_id:result.resourceId,expires_at:new Date(expiry).toISOString()}).eq('id',id);
  if(saveError)throw Error('Channel persistence failed');
  created++;
 }
 // Stop replaced/unselected subscriptions after replacements are established.
 for(const channel of channels||[]){
  if(ids.includes(channel.calendar_id)&&Date.parse(channel.expires_at)>Date.now()+86400000)continue;
  if(channel.resource_id&&Date.parse(channel.expires_at)>Date.now()){
   const stopped=await fetch('https://www.googleapis.com/calendar/v3/channels/stop',{method:'POST',headers:{Authorization:`Bearer ${access}`,'Content-Type':'application/json'},body:JSON.stringify({id:channel.id,resourceId:channel.resource_id}),signal:AbortSignal.timeout(10000)});
   if(!stopped.ok&&stopped.status!==404)continue;
  }
  const {error:deleteError}=await db.from('moa_calendar_channels').delete().eq('id',channel.id);
  if(deleteError)throw Error('Channel cleanup failed');
 }
}

export async function processCalendarJob(){
 const db=adminClient();
 const {data,error}=await db.rpc('moa_claim_calendar');
 if(error)throw Error('Calendar queue unavailable');
 const job=data?.[0];if(!job)return {processed:0};
 let ok=false;
 try{
  const result=await syncOwnerAvailability(job.owner_id,true);
  if(result===false)throw Error('Busy lookup failed');
  await renewCalendarChannels(job.owner_id);
  ok=true;
 }catch{console.error('calendar_background_job_failed')}
 const {error:finishError}=await db.rpc('moa_finish_calendar',{p_owner:job.owner_id,p_lease:job.lease_id,p_version:job.version,p_ok:ok});
 if(finishError)throw Error('Calendar job completion failed');
 return {processed:1,ok};
}
