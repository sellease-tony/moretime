import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {oauthUser,supabaseConfigured} from '@/lib/supabase/server';
import {consentParam,hasConsent} from '@/lib/auth/consent';
import {FLOW_COOKIE,newFlow} from '@/lib/auth/google-oauth';
import {microsoftAuthorizeUrl,microsoftConfigured} from '@/lib/auth/microsoft-oauth';
export const dynamic='force-dynamic';
// Host sign-in with a Microsoft account (Outlook / Microsoft 365 calendar). Guests never need it.
export async function GET(request:Request){
  const origin=process.env.APP_URL||new URL(request.url).origin;
  if(!supabaseConfigured()||!microsoftConfigured())return NextResponse.redirect(new URL('/login?auth_error=configuration',origin));
  const consent=consentParam(new URL(request.url).searchParams.get('consent'))||undefined;
  if(!consent&&!hasConsent((await oauthUser())?.app_metadata))return NextResponse.redirect(new URL('/login?auth_error=consent',origin));
  const flow=newFlow({consent});
  (await cookies()).set(FLOW_COOKIE,JSON.stringify(flow),{httpOnly:true,secure:origin.startsWith('https:'),sameSite:'lax',path:'/auth',maxAge:600});
  return NextResponse.redirect(microsoftAuthorizeUrl(flow,process.env.MICROSOFT_CLIENT_ID!,origin));
}
