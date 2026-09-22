import {currentUser,adminClient} from '@/lib/supabase/server';
import {ownerAccessToken} from '@/lib/calendar/server';
import {syncBooking} from '@/lib/calendar/sync';
export const maxDuration=60;
export async function POST(request:Request){
  if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'허용되지 않은 요청입니다.'},{status:403});
  const user=await currentUser();if(!user)return Response.json({error:'로그인이 필요합니다.'},{status:401});
  try{
    const {cursor}=await request.json();
    let query=adminClient().from('moa_bookings').select('id').eq('owner_id',user.id).order('id').limit(5);
    if(cursor){if(typeof cursor!=='string'||!/^[a-f0-9-]{36}$/.test(cursor))return Response.json({error:'잘못된 요청입니다.'},{status:400});query=query.gt('id',cursor);}
    const {data,error}=await query;if(error)throw error;
    const token=await ownerAccessToken(user.id);
    const results=await Promise.all((data||[]).map(b=>syncBooking(user.id,b.id,token)));
    return Response.json({synced:results.filter(r=>r.synced).length,failed:results.filter(r=>!r.synced).length,next:data?.length===5?data[4].id:null});
  }catch{return Response.json({error:'Google 캘린더를 다시 연결한 후 재시도해 주세요.'},{status:503});}
}
