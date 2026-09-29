import {currentUser} from '@/lib/supabase/server';
import {currentCalendarConstraints} from '@/lib/calendar/availability-sync';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(){
 const user=await currentUser();if(!user)return Response.json({error:'주최자 로그인이 필요합니다.'},{status:401});
 try{return Response.json(await currentCalendarConstraints(user.id),{headers:{'Cache-Control':'private, no-store'}})}
 catch{return Response.json({error:'Google 일정 또는 공휴일을 확인하지 못했습니다. 연결 상태를 확인하고 다시 불러와 주세요.'},{status:503})}
}
