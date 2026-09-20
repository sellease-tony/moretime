import {sessionClient,supabaseConfigured} from '@/lib/supabase/server';
export async function POST(request:Request){
  if(request.headers.get('origin')!==new URL(request.url).origin)return new Response('Forbidden',{status:403});
  if(supabaseConfigured())await (await sessionClient()).auth.signOut();
  return Response.json({ok:true});
}
