import {currentUser,adminClient} from '@/lib/supabase/server';
import {managementUrl} from '@/lib/bookings/manage-token';
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'허용되지 않은 요청입니다.'},{status:403});
 const user=await currentUser();if(!user)return Response.json({error:'로그인이 필요합니다.'},{status:401});
 try{
  const body=await request.text();if(body.length>200)return Response.json({error:'잘못된 요청입니다.'},{status:400});
  const {id}=JSON.parse(body);
  const {data,error}=await adminClient().from('moa_bookings').select('id').eq('owner_id',user.id).eq('id',id).gt('starts_at',new Date().toISOString()).eq('status','confirmed').maybeSingle();
  if(error||!data)return Response.json({error:'관리할 예약을 찾을 수 없습니다.'},{status:404});
  return Response.json({url:managementUrl(data.id)},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return Response.json({error:'링크를 만들지 못했습니다.'},{status:503})}
}
