import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {syncOwnerAvailability} from '@/lib/calendar/availability-sync';
import {markHost,oauthUser,sessionClient} from '@/lib/supabase/server';
import {saveCalendarConnection} from '@/lib/calendar/server';
import {consentParam} from '@/lib/auth/consent';
import {PENDING_COOKIE,decodePending} from '@/lib/auth/pending-signup';
import {RETURN_COOKIE,safeReturnPath} from '@/lib/site';
export const maxDuration=60;
// Completes a first-time sign-up after the /signup form: consent recorded, calendar connected, host role granted.
export async function POST(request:Request){
  const origin=process.env.APP_URL||new URL(request.url).origin;
  const go=(path:string)=>NextResponse.redirect(new URL(path,origin),303);
  if(request.headers.get('origin')!==new URL(request.url).origin)return new Response('Forbidden',{status:403});
  const form=await request.formData().catch(()=>null);
  const consent=consentParam(String(form?.get('consent')||''));
  if(!consent||form?.get('terms')!=='on'||form?.get('privacy')!=='on')return go('/signup?error=consent');
  const user=await oauthUser();
  if(!user)return go('/login');
  const jar=await cookies(),pending=decodePending(jar.get(PENDING_COOKIE)?.value,user.id);
  if(!pending)return go('/login?auth_error=signup_expired');
  try{await saveCalendarConnection(user.id,pending.refreshToken,pending.provider)}catch{return go('/login?auth_error=calendar')}
  try{await markHost(user.id,{version:consent,agreedAt:new Date().toISOString()});const {error}=await (await sessionClient()).auth.refreshSession();if(error)throw error}catch{return go('/login?auth_error=callback')}
  jar.delete(PENDING_COOKIE);
  try{await syncOwnerAvailability(user.id,true)}catch{return go('/app?auth_error=calendar')}
  const back=safeReturnPath(jar.get(RETURN_COOKIE)?.value);if(back)jar.delete(RETURN_COOKIE);
  return go(back||'/app');
}
