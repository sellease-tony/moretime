import {createServerClient} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';
import {isHost} from '@/lib/auth/role';
import {legacyRedirect,RETURN_COOKIE,safeReturnPath} from '@/lib/site';

export async function proxy(request:NextRequest){
  // Permanent move from the old vercel.app address; the URL fragment (guest management token) is kept by the browser.
  const moved=legacyRedirect(request.nextUrl);if(moved)return NextResponse.redirect(moved,308);
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
  // Guests may hold a Google session for booking prefill; only hosts are routed into the workspace.
  const signedIn=!error&&!!data?.claims?.sub&&isHost(data.claims.app_metadata);
  const path=request.nextUrl.pathname;
  const target=path==='/'&&signedIn?'/app':(path==='/app'||path.startsWith('/app/'))&&!signedIn?'/':null;
  if(target){
    const redirect=NextResponse.redirect(new URL(target,request.url));
    response.cookies.getAll().forEach(cookie=>redirect.cookies.set(cookie));
    // Remember a booking deep link so Google login can bring the host straight back to it.
    const back=!signedIn&&safeReturnPath(path+request.nextUrl.search);
    if(back)redirect.cookies.set(RETURN_COOKIE,back,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:600});
    response=redirect;
  }
  response.headers.set('Cache-Control','private, no-store');
  return response;
}
export const config={matcher:['/','/app/:path*','/admin/:path*','/login','/auth/:path*','/book/:path*','/booking/:path*','/poll/:path*','/privacy','/terms','/api/workspace','/api/integrations','/api/availability/:path*','/api/calendar/sync','/api/public-links','/api/public/:path*']};
