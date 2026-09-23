import {z} from 'zod';
import {currentUser} from '@/lib/supabase/server';
import {ownerBusy} from '@/lib/calendar/server';
import {availableSlots} from '@/lib/calendar/google';
import {addDays,kstDay} from '@/lib/availability';
import {validDay} from '@/lib/bookings/server';
export const maxDuration=60;
const schema=z.object({start:z.string(),end:z.string(),duration:z.union([z.literal(15),z.literal(30),z.literal(60)]),hours:z.array(z.boolean()).length(7),range:z.tuple([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)])}).strict();
export async function POST(request:Request){
  if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'허용되지 않은 요청입니다.'},{status:403});
  const user=await currentUser();if(!user)return Response.json({error:'주최자 로그인이 필요합니다.'},{status:401});
  try{
    const raw=await request.text();if(raw.length>2000)return Response.json({error:'요청이 너무 큽니다.'},{status:413});
    const parsed=schema.safeParse(JSON.parse(raw));if(!parsed.success)return Response.json({error:'날짜와 시간을 확인해 주세요.'},{status:400});
    const {start,end,duration,hours,range}=parsed.data;
    if(!validDay(start)||!validDay(end)||start<kstDay()||end<start||range[0]>=range[1])return Response.json({error:'오늘부터 90일 이내의 기간과 올바른 시간 범위를 선택해 주세요.'},{status:400});
    const busy=await ownerBusy(user.id,new Date(start+'T00:00:00+09:00').toISOString(),new Date(addDays(end,1)+'T00:00:00+09:00').toISOString());
    const days:Record<string,string[]>={};
    for(let day=start;day<=end;day=addDays(day,1))days[day]=availableSlots(day,duration,hours,range,busy);
    return Response.json({availability:{days,source:'google',updatedAt:new Date().toISOString(),importedAt:new Date().toISOString()}},{headers:{'Cache-Control':'no-store'}});
  }catch{return Response.json({error:'Google 캘린더를 가져오지 못했습니다. 연결 상태를 확인해 주세요. 기존 선택은 유지됩니다.'},{status:503});}
}
