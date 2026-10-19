import {NextResponse} from 'next/server';
import {googleUser,sessionClient,supabaseConfigured} from '@/lib/supabase/server';
import {CONSENT_COOKIE,consentParam,hasConsent} from '@/lib/auth/consent';
import {cookies} from 'next/headers';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  const origin=process.env.APP_URL||new URL(request.url).origin;
  if(!supabaseConfigured())return NextResponse.redirect(new URL('/login?auth_error=configuration',origin));
  const client=await sessionClient();
  const next=new URL(request.url).searchParams.get('next');
  const callback=new URL('/auth/callback',origin);
  if(next&&/^\/book\/[a-f0-9-]{36}$/.test(next))callback.searchParams.set('next',next);
  else{
    // Host sign-up needs the terms and privacy consent from the login screen, unless this account already gave it.
    const consent=consentParam(new URL(request.url).searchParams.get('consent'));
    if(consent)(await cookies()).set(CONSENT_COOKIE,consent,{httpOnly:true,secure:origin.startsWith('https:'),sameSite:'lax',path:'/auth',maxAge:600});
    else if(!hasConsent((await googleUser())?.app_metadata))return NextResponse.redirect(new URL('/login?auth_error=consent',origin));
  }
  const {data,error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:callback.href,scopes:callback.searchParams.has('next')?'openid email profile':'https://www.googleapis.com/auth/calendar.events.freebusy https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events.owned',queryParams:callback.searchParams.has('next')?{prompt:'select_account'}:{prompt:'consent',access_type:'offline'}}});
  if(error||!data.url)return NextResponse.redirect(new URL('/login?auth_error=signin',origin));
  return NextResponse.redirect(data.url);
}
