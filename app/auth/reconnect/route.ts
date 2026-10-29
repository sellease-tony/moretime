import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/supabase/server';
import {ownerCalendarProvider} from '@/lib/calendar/server';
export const dynamic='force-dynamic';
// "다시 연결" links: send the host back through the sign-in of the calendar they actually use.
export async function GET(request:Request){
  const origin=process.env.APP_URL||new URL(request.url).origin;
  const user=await currentUser();
  if(!user)return NextResponse.redirect(new URL('/login',origin));
  let provider=null;try{provider=await ownerCalendarProvider(user.id)}catch{}
  return NextResponse.redirect(new URL(provider==='microsoft'?'/auth/microsoft':'/auth/google',origin));
}
