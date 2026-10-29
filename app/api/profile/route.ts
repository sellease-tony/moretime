import {currentUser} from '@/lib/supabase/server';
import {handleOf,setHandle} from '@/lib/handles-server';
const json=(b:unknown,s=200)=>Response.json(b,{status:s,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){
  const user=await currentUser();if(!user)return json({error:'로그인이 필요합니다.'},401);
  try{return json({handle:await handleOf(user.id)})}catch{return json({error:'예약 주소를 불러오지 못했습니다.'},503)}
}
export async function POST(request:Request){
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'허용되지 않은 요청입니다.'},403);
  const user=await currentUser();if(!user)return json({error:'로그인이 필요합니다.'},401);
  let body:{handle?:unknown};try{body=await request.json()}catch{return json({error:'잘못된 요청입니다.'},400)}
  if(typeof body.handle!=='string'||body.handle.length>40)return json({error:'예약 주소를 입력해 주세요.'},400);
  const r=await setHandle(user.id,body.handle);
  return r.ok?json({handle:r.handle}):json({error:r.error},r.status);
}
