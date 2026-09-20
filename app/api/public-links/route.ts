import {currentUser,adminClient} from '@/lib/supabase/server';
import {loadOwner} from '@/lib/bookings/server';
export async function POST(request:Request){
  if(request.headers.get('origin')!==new URL(request.url).origin)return new Response('Forbidden',{status:403});
  const user=await currentUser();if(!user)return Response.json({error:'Google 로그인이 필요합니다.'},{status:401});
  try{
    const {eventId}=await request.json(),{state}=await loadOwner(user.id);
    if(typeof eventId!=='string'||!state.events.some(e=>e.id===eventId&&e.active))return Response.json({error:'활성 예약 페이지를 선택해 주세요.'},{status:400});
    const {data,error}=await adminClient().from('moa_public_links').upsert({owner_id:user.id,event_id:eventId},{onConflict:'owner_id,event_id'}).select('id').single();
    if(error)throw Error();return Response.json({path:`/book/${data.id}`});
  }catch{return Response.json({error:'예약 링크를 만들지 못했습니다.'},{status:503})}
}
