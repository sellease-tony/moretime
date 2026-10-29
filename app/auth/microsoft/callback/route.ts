import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {syncOwnerAvailability} from '@/lib/calendar/availability-sync';
import {markHost,sessionClient,supabaseConfigured} from '@/lib/supabase/server';
import {saveCalendarConnection} from '@/lib/calendar/server';
import {RETURN_COOKIE,safeReturnPath} from '@/lib/site';
import {hasConsent} from '@/lib/auth/consent';
import {FLOW_COOKIE,readFlow} from '@/lib/auth/google-oauth';
import {exchangeMicrosoftCode} from '@/lib/auth/microsoft-oauth';
export const maxDuration=60;
export async function GET(request:Request){
  const origin=process.env.APP_URL||new URL(request.url).origin;
  const params=new URL(request.url).searchParams;
  const jar=await cookies(),flow=readFlow(jar.get(FLOW_COOKIE)?.value);
  jar.delete({name:FLOW_COOKIE,path:'/auth'});
  const fail=(reason:string)=>NextResponse.redirect(new URL('/login?auth_error='+reason,origin));
  const code=params.get('code');
  if(!supabaseConfigured()||!flow||flow.next||!code||params.get('state')!==flow.state)return fail(params.get('error')==='access_denied'?'signin':'callback');

  let tokens;
  try{tokens=await exchangeMicrosoftCode(code,flow,origin)}catch{return fail('callback')}
  const sb=await sessionClient();
  const {data,error}=await sb.auth.signInWithIdToken({provider:'azure',token:tokens.id_token,nonce:flow.nonce});
  if(error||!data.user){console.error('microsoft_signin_failed',error?.code||error?.status||'no_user');return fail('microsoft')}

  if(!flow.consent&&!hasConsent(data.user.app_metadata)){await sb.auth.signOut();return NextResponse.redirect(new URL('/login?auth_error=consent',origin))}
  if(!tokens.refresh_token)return fail('calendar');
  try{await saveCalendarConnection(data.user.id,tokens.refresh_token,'microsoft')}catch{return fail('calendar')}
  try{await markHost(data.user.id,flow.consent?{version:flow.consent,agreedAt:new Date().toISOString()}:null);const {error:refreshError}=await sb.auth.refreshSession();if(refreshError)throw refreshError}catch{return fail('callback')}
  try{await syncOwnerAvailability(data.user.id,true)}catch{return NextResponse.redirect(new URL('/app?auth_error=calendar',origin))}
  const back=safeReturnPath(jar.get(RETURN_COOKIE)?.value);if(back)jar.delete(RETURN_COOKIE);
  return NextResponse.redirect(new URL(back||'/app',origin));
}
