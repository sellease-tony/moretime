import 'server-only';
import {adminClient} from '@/lib/supabase/server';
import {encryptToken,decryptToken} from './crypto';
import {CalendarError,queryGoogleBusy} from './google';
import {queryMicrosoftBusy} from './microsoft';
import {refreshMicrosoftToken} from '@/lib/auth/microsoft-oauth';

export type CalendarProvider='google'|'microsoft';
export type CalendarConnection={provider:CalendarProvider;access:string};
const hasKey=()=>!!process.env.CALENDAR_TOKEN_ENCRYPTION_KEY;
export function calendarConfigured(provider:CalendarProvider='google'){
 return hasKey()&&(provider==='microsoft'?!!(process.env.MICROSOFT_CLIENT_ID&&process.env.MICROSOFT_CLIENT_SECRET):!!(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET));
}
// One calendar per host: connecting Outlook replaces a Google connection and vice versa.
export async function saveCalendarConnection(owner:string,refreshToken:string,provider:CalendarProvider='google'){
 const {error}=await adminClient().from('moa_google_connections').upsert({owner_id:owner,provider,refresh_token_enc:encryptToken(refreshToken),updated_at:new Date().toISOString()});
 if(error)throw new CalendarError('캘린더 연결 정보를 저장하지 못했습니다.');
}
export async function ownerCalendarProvider(owner:string):Promise<CalendarProvider|null>{
 const {data,error}=await adminClient().from('moa_google_connections').select('provider').eq('owner_id',owner).maybeSingle();
 if(error)throw new CalendarError('캘린더 연결을 확인하지 못했습니다.');
 return (data?.provider as CalendarProvider)||null;
}
export async function ownerConnection(owner:string):Promise<CalendarConnection>{
 const db=adminClient();const {data,error}=await db.from('moa_google_connections').select('refresh_token_enc,provider').eq('owner_id',owner).maybeSingle();
 if(error||!data)throw new CalendarError('주최자의 캘린더 연결이 필요합니다.');
 const provider=(data.provider||'google') as CalendarProvider;
 if(!calendarConfigured(provider))throw new CalendarError('캘린더 연결 설정이 필요합니다.');
 const refresh=decryptToken(data.refresh_token_enc);
 if(provider==='microsoft'){
  let t;try{t=await refreshMicrosoftToken(refresh)}catch{throw new CalendarError('Outlook 캘린더를 다시 연결해 주세요.')}
  // Microsoft rotates refresh tokens; keep the newest so the connection does not expire.
  if(t.refresh_token&&t.refresh_token!==refresh)await db.from('moa_google_connections').update({refresh_token_enc:encryptToken(t.refresh_token),updated_at:new Date().toISOString()}).eq('owner_id',owner).eq('provider','microsoft');
  return {provider,access:t.access_token};
 }
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID!,client_secret:process.env.GOOGLE_CLIENT_SECRET!,refresh_token:refresh,grant_type:'refresh_token'}),signal:AbortSignal.timeout(10000),cache:'no-store'});
 if(!r.ok)throw new CalendarError('Google 캘린더를 다시 연결해 주세요.');
 const token=await r.json() as {access_token?:string};if(!token.access_token)throw new CalendarError('Google 캘린더를 다시 연결해 주세요.');
 return {provider,access:token.access_token};
}

export async function ownerBusy(owner:string,start:string,end:string){
 const c=await ownerConnection(owner);
 return c.provider==='microsoft'?queryMicrosoftBusy(c.access,start,end):queryGoogleBusy(c.access,start,end);
}
