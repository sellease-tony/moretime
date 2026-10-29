import {PENDING_COOKIE,encodePending,pendingCookieOptions} from '@/lib/auth/pending-signup';
import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {syncOwnerAvailability} from '@/lib/calendar/availability-sync';
import {markHost,sessionClient,supabaseConfigured} from '@/lib/supabase/server';
import {saveCalendarConnection} from '@/lib/calendar/server';
import {RETURN_COOKIE,safeReturnPath} from '@/lib/site';
import {hasConsent} from '@/lib/auth/consent';
import {FLOW_COOKIE,exchangeCode,readFlow} from '@/lib/auth/google-oauth';
export const maxDuration=60;
export async function GET(request:Request){
  const origin=process.env.APP_URL||new URL(request.url).origin;
  const params=new URL(request.url).searchParams;
  const jar=await cookies(),flow=readFlow(jar.get(FLOW_COOKIE)?.value);
  jar.delete({name:FLOW_COOKIE,path:'/auth'});
  const fail=(reason:string)=>NextResponse.redirect(new URL(flow?.next||'/login?auth_error='+reason,origin));
  const code=params.get('code');
  if(!supabaseConfigured()||!flow||!code||params.get('state')!==flow.state)return fail(params.get('error')==='access_denied'?'signin':'callback');

  let tokens;
  try{tokens=await exchangeCode(code,flow,origin)}catch{return fail('callback')}
  const sb=await sessionClient();
  const {data,error}=await sb.auth.signInWithIdToken({provider:'google',token:tokens.id_token,access_token:tokens.access_token,nonce:flow.nonce});
  if(error||!data.user)return fail('callback');
  if(flow.next)return NextResponse.redirect(new URL(flow.next,origin));

  // First sign-in (or a material terms change): the member agrees on /signup first; nothing is stored until then.
  if(!hasConsent(data.user.app_metadata)){
    if(!tokens.refresh_token)return NextResponse.redirect(new URL('/login?auth_error=calendar',origin));
    jar.set(PENDING_COOKIE,encodePending({uid:data.user.id,provider:'google',refreshToken:tokens.refresh_token}),pendingCookieOptions(origin.startsWith('https:')));
    return NextResponse.redirect(new URL('/signup',origin));
  }
  if(tokens.refresh_token){try{await saveCalendarConnection(data.user.id,tokens.refresh_token)}catch{return NextResponse.redirect(new URL('/login?auth_error=calendar',origin))}}
  // Only the host flow grants the role; refresh so the session cookie carries it for proxy redirects.
  try{await markHost(data.user.id);const {error:refreshError}=await sb.auth.refreshSession();if(refreshError)throw refreshError}catch{return NextResponse.redirect(new URL('/login?auth_error=callback',origin))}
  try{await syncOwnerAvailability(data.user.id,true)}catch{return NextResponse.redirect(new URL('/app?auth_error=calendar',origin))}
  const back=safeReturnPath(jar.get(RETURN_COOKIE)?.value);if(back)jar.delete(RETURN_COOKIE);
  return NextResponse.redirect(new URL(back||'/app',origin));
}
