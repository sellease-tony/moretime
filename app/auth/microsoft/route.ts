import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {supabaseConfigured} from '@/lib/supabase/server';
import {FLOW_COOKIE,newFlow} from '@/lib/auth/google-oauth';
import {microsoftAuthorizeUrl,microsoftConfigured} from '@/lib/auth/microsoft-oauth';
export const dynamic='force-dynamic';
// Host sign-in with a Microsoft account (Outlook / Microsoft 365 calendar). Guests never need it.
export async function GET(request:Request){
  const origin=process.env.APP_URL||new URL(request.url).origin;
  if(!supabaseConfigured()||!microsoftConfigured())return NextResponse.redirect(new URL('/login?auth_error=configuration',origin));
  // Consent is collected after sign-in, on /signup, for first-time members only.
  const flow=newFlow({});
  (await cookies()).set(FLOW_COOKIE,JSON.stringify(flow),{httpOnly:true,secure:origin.startsWith('https:'),sameSite:'lax',path:'/auth',maxAge:600});
  return NextResponse.redirect(microsoftAuthorizeUrl(flow,process.env.MICROSOFT_CLIENT_ID!,origin));
}
