import 'server-only';
import {adminClient} from '@/lib/supabase/server';
import {encryptToken,decryptToken} from './crypto';
import {CalendarError,queryGoogleBusy} from './google';
export function calendarConfigured(){return !!(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&process.env.CALENDAR_TOKEN_ENCRYPTION_KEY)}
export async function saveCalendarConnection(owner:string,refreshToken:string){
  const {error}=await adminClient().from('moa_google_connections').upsert({owner_id:owner,refresh_token_enc:encryptToken(refreshToken),updated_at:new Date().toISOString()});
  if(error)throw new CalendarError('캘린더 연결 정보를 저장하지 못했습니다.');
}
export async function ownerAccessToken(owner:string){
  if(!calendarConfigured())throw new CalendarError('Google Calendar 연결 설정이 필요합니다.');
  const db=adminClient();const {data,error}=await db.from('moa_google_connections').select('refresh_token_enc').eq('owner_id',owner).maybeSingle();
  if(error||!data)throw new CalendarError('주최자의 Google 캘린더 연결이 필요합니다.');
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID!,client_secret:process.env.GOOGLE_CLIENT_SECRET!,refresh_token:decryptToken(data.refresh_token_enc),grant_type:'refresh_token'}),signal:AbortSignal.timeout(10000),cache:'no-store'});
  if(!r.ok)throw new CalendarError('Google 캘린더를 다시 연결해 주세요.');
  const token=await r.json() as {access_token?:string};if(!token.access_token)throw new CalendarError('Google 캘린더를 다시 연결해 주세요.');
  return token.access_token;
}

export async function ownerBusy(owner:string,start:string,end:string){return queryGoogleBusy(await ownerAccessToken(owner),start,end)}
