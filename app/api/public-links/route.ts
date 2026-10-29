import {currentUser} from '@/lib/supabase/server';
import {loadOwner} from '@/lib/bookings/server';
import {handleOf,publicLinkId} from '@/lib/handles-server';
import {prettyPath} from '@/lib/handles';
export async function POST(request:Request){
  if(request.headers.get('origin')!==new URL(request.url).origin)return new Response('Forbidden',{status:403});
  const user=await currentUser();if(!user)return Response.json({error:'Google 로그인이 필요합니다.'},{status:401});
  try{
    const {eventId}=await request.json(),{state}=await loadOwner(user.id);
    const event=typeof eventId==='string'?(state.events as {id:string;active:boolean;slug?:string}[]).find(e=>e.id===eventId&&e.active):undefined;
    if(!event)return Response.json({error:'활성 예약 페이지를 선택해 주세요.'},{status:400});
    const [id,handle]=await Promise.all([publicLinkId(user.id,event.id),handleOf(user.id)]);
    // The personal address when both parts are set; the /book/{id} link always keeps working.
    return Response.json({path:handle&&event.slug?prettyPath(handle,event.slug):`/book/${id}`});
  }catch{return Response.json({error:'예약 링크를 만들지 못했습니다.'},{status:503})}
}
