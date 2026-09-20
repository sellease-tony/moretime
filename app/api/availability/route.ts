import {currentUser} from '@/lib/supabase/server';
import {slotsFor,validDay} from '@/lib/bookings/server';
export const dynamic='force-dynamic';
export async function GET(r:Request){
  const user=await currentUser();if(!user)return Response.json({error:'Google 로그인이 필요합니다.'},{status:401});
  const url=new URL(r.url),day=url.searchParams.get('day')||'',id=url.searchParams.get('eventId')||'';
  if(!validDay(day)||!id)return Response.json({error:'오늘부터 90일 이내의 날짜를 선택해 주세요.'},{status:400});
  try{const {slots}=await slotsFor(user.id,id,day);return Response.json({slots},{headers:{'Cache-Control':'no-store'}})}catch(e){return Response.json({error:e instanceof Error?e.message:'캘린더 조회에 실패했습니다.'},{status:503})}
}
