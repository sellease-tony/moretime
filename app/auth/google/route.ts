import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {oauthUser,supabaseConfigured} from '@/lib/supabase/server';
import {consentParam,hasConsent} from '@/lib/auth/consent';
import {FLOW_COOKIE,authorizeUrl,guestNext,newFlow} from '@/lib/auth/google-oauth';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  const origin=process.env.APP_URL||new URL(request.url).origin;
  if(!supabaseConfigured()||!process.env.GOOGLE_CLIENT_ID||!process.env.GOOGLE_CLIENT_SECRET)return NextResponse.redirect(new URL('/login?auth_error=configuration',origin));
  const params=new URL(request.url).searchParams;
  const next=guestNext(params.get('next'));
  let consent:string|undefined;
  if(!next){
    // Host sign-up needs the terms and privacy consent from the login screen, unless this account already gave it.
    consent=consentParam(params.get('consent'))||undefined;
    if(!consent&&!hasConsent((await oauthUser())?.app_metadata))return NextResponse.redirect(new URL('/login?auth_error=consent',origin));
  }
  const flow=newFlow({next,consent});
  (await cookies()).set(FLOW_COOKIE,JSON.stringify(flow),{httpOnly:true,secure:origin.startsWith('https:'),sameSite:'lax',path:'/auth',maxAge:600});
  return NextResponse.redirect(authorizeUrl(flow,process.env.GOOGLE_CLIENT_ID,origin));
}
