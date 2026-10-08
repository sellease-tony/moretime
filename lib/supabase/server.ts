import 'server-only';
import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {HOST_ROLE,isGoogle,isHost} from '@/lib/auth/role';

export function supabaseConfigured(){return !!(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY&&process.env.SUPABASE_SECRET_KEY)}
export async function sessionClient(){
  const jar=await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{
    cookies:{getAll:()=>jar.getAll(),setAll(values){for(const {name,value,options} of values)jar.set(name,value,options)}}
  });
}
export function adminClient(){
  if(!supabaseConfigured())throw new Error('Supabase 설정이 필요합니다.');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
}
// Any Google session, including guests who signed in only to prefill a booking form.
export async function googleUser(){
  if(!supabaseConfigured())return null;
  const sb=await sessionClient();
  const {data:{user},error}=await sb.auth.getUser();
  if(error||!user||!isGoogle(user.app_metadata))return null;
  return user;
}
// Host only: required for /app and every owner API.
export async function currentUser(){
  const user=await googleUser();
  return user&&isHost(user.app_metadata)?user:null;
}
export async function markHost(id:string){
  const {error}=await adminClient().auth.admin.updateUserById(id,{app_metadata:{moa_role:HOST_ROLE}});
  if(error)throw new Error('주최자 계정을 확인하지 못했습니다.');
}
