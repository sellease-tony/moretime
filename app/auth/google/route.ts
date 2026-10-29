import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {supabaseConfigured} from '@/lib/supabase/server';
import {FLOW_COOKIE,authorizeUrl,guestNext,newFlow} from '@/lib/auth/google-oauth';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  const origin=process.env.APP_URL||new URL(request.url).origin;
  if(!supabaseConfigured()||!process.env.GOOGLE_CLIENT_ID||!process.env.GOOGLE_CLIENT_SECRET)return NextResponse.redirect(new URL('/login?auth_error=configuration',origin));
  const params=new URL(request.url).searchParams;
  const next=guestNext(params.get('next'));
  // Consent is collected after sign-in, on /signup, for first-time members only.
  const flow=newFlow({next});
  (await cookies()).set(FLOW_COOKIE,JSON.stringify(flow),{httpOnly:true,secure:origin.startsWith('https:'),sameSite:'lax',path:'/auth',maxAge:600});
  return NextResponse.redirect(authorizeUrl(flow,process.env.GOOGLE_CLIENT_ID,origin));
}
