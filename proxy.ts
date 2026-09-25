import {createServerClient} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';

export async function proxy(request:NextRequest){
  let response=NextResponse.next({request});
  if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)return response;
  const sb=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{
    cookies:{getAll:()=>request.cookies.getAll(),setAll(values){
      values.forEach(({name,value})=>request.cookies.set(name,value));
      response=NextResponse.next({request});
      values.forEach(({name,value,options})=>response.cookies.set(name,value,options));
    }}
  });
  const {data,error}=await sb.auth.getClaims();
  const signedIn=!error&&!!data?.claims?.sub&&data.claims.app_metadata?.provider==='google';
  const path=request.nextUrl.pathname;
  const target=path==='/'&&signedIn?'/app':(path==='/app'||path.startsWith('/app/'))&&!signedIn?'/':null;
  if(target){
    const redirect=NextResponse.redirect(new URL(target,request.url));
    response.cookies.getAll().forEach(cookie=>redirect.cookies.set(cookie));
    response=redirect;
  }
  response.headers.set('Cache-Control','private, no-store');
  return response;
}
export const config={matcher:['/','/app/:path*','/login','/auth/:path*','/book/:path*','/api/workspace','/api/integrations','/api/availability/:path*','/api/calendar/:path*','/api/public-links','/api/public/:path*']};
