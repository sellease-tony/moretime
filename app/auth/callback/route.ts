import {syncOwnerAvailability} from '@/lib/calendar/availability-sync';
export const maxDuration=60;
import {NextResponse} from 'next/server';
import {sessionClient,supabaseConfigured} from '@/lib/supabase/server';
import {saveCalendarConnection} from '@/lib/calendar/server';
export async function GET(request:Request){
  const origin=process.env.APP_URL||new URL(request.url).origin;
  const code=new URL(request.url).searchParams.get('code');
  if(code&&supabaseConfigured()){
    const sb=await sessionClient();const {data,error}=await sb.auth.exchangeCodeForSession(code);
    if(!error&&data.user){
      if(!/^\/book\/[a-f0-9-]{36}$/.test(new URL(request.url).searchParams.get('next')||'')&&data.session?.provider_refresh_token){try{await saveCalendarConnection(data.user.id,data.session.provider_refresh_token)}catch{return NextResponse.redirect(new URL('/login?auth_error=calendar',origin))}}
      const next=new URL(request.url).searchParams.get('next');
      if(!next||!/^\/book\/[a-f0-9-]{36}$/.test(next)){try{await syncOwnerAvailability(data.user.id,true)}catch{return NextResponse.redirect(new URL('/app?auth_error=calendar',origin))}} 
      return NextResponse.redirect(new URL(next&&/^\/book\/[a-f0-9-]{36}$/.test(next)?next:'/app',origin));
    }
  }
  return NextResponse.redirect(new URL('/login?auth_error=callback',origin));
}
