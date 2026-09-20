import 'server-only';
import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';

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
export async function currentUser(){
  if(!supabaseConfigured())return null;
  const sb=await sessionClient();
  const {data:{user},error}=await sb.auth.getUser();
  if(error||!user||user.app_metadata.provider!=='google')return null;
  return user;
}
