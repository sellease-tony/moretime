import {currentUser,adminClient} from '@/lib/supabase/server';
import {defaultReminders} from '@/lib/notifications/reminders';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'허용되지 않은 요청입니다.'},403);
 const user=await currentUser();if(!user)return json({error:'로그인이 필요합니다.'},401);
 try{
  const text=await request.text();if(text.length>500)return json({error:'잘못된 설정입니다.'},400);
  const body=JSON.parse(text),keys=Object.keys(defaultReminders);
  if(!body||Object.keys(body).length!==keys.length||keys.some(k=>typeof body[k]!=='boolean'))return json({error:'설정값을 확인해 주세요.'},400);
  const {error}=await adminClient().from('moa_reminder_settings').upsert({owner_id:user.id,...body,updated_at:new Date().toISOString()});
  if(error)throw Error();return json({ok:true,reminders:body});
 }catch{return json({error:'리마인더 설정을 저장하지 못했습니다.'},503)}
}
