import {syncOwnerAvailability} from '@/lib/calendar/availability-sync';
export const maxDuration=60;
import {NextResponse} from 'next/server';
import {markHost,sessionClient,supabaseConfigured} from '@/lib/supabase/server';
import {saveCalendarConnection} from '@/lib/calendar/server';
import {cookies} from 'next/headers';
import {RETURN_COOKIE,safeReturnPath} from '@/lib/site';
export async function GET(request:Request){
  const origin=process.env.APP_URL||new URL(request.url).origin;
  const code=new URL(request.url).searchParams.get('code');
  if(code&&supabaseConfigured()){
    const sb=await sessionClient();const {data,error}=await sb.auth.exchangeCodeForSession(code);
    if(!error&&data.user){
      const next=new URL(request.url).searchParams.get('next');
      if(!next||!/^\/book\/[a-f0-9-]{36}$/.test(next)){
        if(data.session?.provider_refresh_token){try{await saveCalendarConnection(data.user.id,data.session.provider_refresh_token)}catch{return NextResponse.redirect(new URL('/login?auth_error=calendar',origin))}}
        // Only the host consent flow grants the role; refresh so the session cookie carries it for proxy redirects.
        try{await markHost(data.user.id);const {error:refreshError}=await sb.auth.refreshSession();if(refreshError)throw refreshError}catch{return NextResponse.redirect(new URL('/login?auth_error=callback',origin))}
        try{await syncOwnerAvailability(data.user.id,true)}catch{return NextResponse.redirect(new URL('/app?auth_error=calendar',origin))}
      }
      if(next&&/^\/book\/[a-f0-9-]{36}$/.test(next))return NextResponse.redirect(new URL(next,origin));
      const jar=await cookies(),back=safeReturnPath(jar.get(RETURN_COOKIE)?.value);if(back)jar.delete(RETURN_COOKIE);
      return NextResponse.redirect(new URL(back||'/app',origin));
    }
  }
  return NextResponse.redirect(new URL('/login?auth_error=callback',origin));
}
