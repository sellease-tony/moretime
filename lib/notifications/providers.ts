import {managementUrl} from '@/lib/bookings/manage-token';
import {SolapiMessageService} from 'solapi';
import type {Booking} from '@/lib/workspace';
export type Channel='email'|'sms'|'kakao';
export type NoticeJob={id:string;owner_id:string;booking_id:string;channel:Channel;recipient_role?:'host'|'guest';event_type:'confirmed'|'cancelled';destination:string;payload:Booking & {previousDay?:string;previousTime?:string};mode:'off'|'dry-run'|'live';attempts:number;lease_token:string;created_at:string;expires_at:string};
export type Delivery={status:'accepted'|'simulated'|'disabled'|'blocked'|'failed'|'unknown'|'retry';providerId?:string;error?:string};
type Environment=Record<string,string|undefined>;
export function notificationMode(e:Environment=process.env):'off'|'dry-run'|'live'{return e.NOTIFICATION_MODE==='live'?'live':e.NOTIFICATION_MODE==='dry-run'?'dry-run':'off'}
export function integrationStatus(e:Environment=process.env){return {
  mode:notificationMode(e),
  email:!!(e.RESEND_API_KEY&&e.EMAIL_FROM),
  sms:!!(e.SOLAPI_API_KEY&&e.SOLAPI_API_SECRET&&e.SOLAPI_FROM),
  kakao:!!(e.SOLAPI_API_KEY&&e.SOLAPI_API_SECRET&&e.SOLAPI_FROM&&e.KAKAO_PF_ID&&e.KAKAO_TEMPLATE_CONFIRMED&&e.KAKAO_TEMPLATE_CANCELLED),
  scheduler:!!e.CRON_SECRET,
}}
export function noticeText(j:NoticeJob){
  const state=j.event_type==='confirmed'?(j.payload.previousDay?'변경':'확정'):'취소';
  const intro=j.recipient_role==='host'?`${j.payload.name}님의 예약이 ${state}되었습니다.\n예약자 이메일: ${j.payload.email}`:`${j.payload.name}님, 예약이 ${state}되었습니다.`;
  return `[모아타임] 예약 ${state}\n${intro}\n일정: ${j.payload.title}\n일시: ${j.payload.day} ${j.payload.time} (한국시간)\n소요 시간: ${j.payload.duration}분${j.payload.previousDay?`\n변경 전: ${j.payload.previousDay} ${j.payload.previousTime} (한국시간)`:""}`;
}
export function solapiMessage(j:NoticeJob,e:Environment){
  if(j.channel==='sms')return {to:j.destination,from:e.SOLAPI_FROM!,text:noticeText(j),type:'LMS' as const,subject:j.event_type==='confirmed'?'예약 확정 안내':'예약 취소 안내'};
  return {to:j.destination,from:e.SOLAPI_FROM!,type:'ATA' as const,kakaoOptions:{pfId:e.KAKAO_PF_ID!,templateId:(j.event_type==='confirmed'?e.KAKAO_TEMPLATE_CONFIRMED:e.KAKAO_TEMPLATE_CANCELLED)!,disableSms:true,variables:{'#{이름}':j.payload.name,'#{일정명}':j.payload.title,'#{일시}':`${j.payload.day} ${j.payload.time} (한국시간)`,'#{소요시간}':String(j.payload.duration)}}};
}
type Dependencies={fetcher?:typeof fetch;sendSolapi?:(message:ReturnType<typeof solapiMessage>)=>Promise<{groupInfo?:{groupId?:string;count?:{registeredSuccess?:number;registeredFailed?:number}};failedMessageList?:readonly unknown[]}>};
export async function deliver(j:NoticeJob,e:Environment=process.env,deps:Dependencies={}):Promise<Delivery>{
  // Snapshot mode prevents old test/off jobs being sent when deployment is switched live.
  if(j.mode==='off'||notificationMode(e)==='off')return {status:'disabled'};
  if(j.mode==='dry-run'||notificationMode(e)==='dry-run')return {status:'simulated'};
  const config=integrationStatus(e);
  if(!config[j.channel])return {status:'blocked',error:'발송 서비스 설정이 필요합니다.'};
  if(j.channel==='email'){
    try{
      const res=await (deps.fetcher||fetch)('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${e.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`moatime/${j.id}`},body:JSON.stringify({from:e.EMAIL_FROM,to:[j.destination],subject:`[모아타임] ${j.event_type==='confirmed'?(j.payload.previousDay?'예약 변경':'예약 확정'):'예약 취소'} · ${j.payload.title}`,text:noticeText(j)+(j.recipient_role!=='host'&&j.event_type==='confirmed'&&e.APP_URL&&e.CALENDAR_TOKEN_ENCRYPTION_KEY?`\n\n예약 변경·취소: ${managementUrl(j.booking_id,e.APP_URL,e.CALENDAR_TOKEN_ENCRYPTION_KEY)}\n예약 시작 전까지 로그인 없이 변경·취소할 수 있습니다. 이 링크는 다른 사람에게 공유하지 마세요.`:'')}),signal:AbortSignal.timeout(12000)});
      if(!res.ok){const retry=[429,500,502,503,504].includes(res.status);return {status:retry?'retry':'failed',error:`이메일 서비스 응답 오류 (${res.status})`}};
      const body=await res.json() as {id?:string};
      return body.id?{status:'accepted',providerId:body.id}:{status:'retry',error:'이메일 접수 결과를 확인하지 못했습니다.'};
    }catch{return {status:'retry',error:'이메일 접수 결과를 확인하지 못했습니다.'}}
  }
  try{
    const send=deps.sendSolapi||((message:ReturnType<typeof solapiMessage>)=>new SolapiMessageService(e.SOLAPI_API_KEY!,e.SOLAPI_API_SECRET!).send(message));
    const result=await send(solapiMessage(j,e));
    if(result.failedMessageList?.length||(result.groupInfo?.count?.registeredFailed||0)>0)return {status:'failed',error:'발송 요청이 거절되었습니다. SOLAPI 발송 내역을 확인해 주세요.',providerId:result.groupInfo?.groupId};
    if(result.groupInfo?.groupId&&(result.groupInfo.count?.registeredSuccess||0)>0)return {status:'accepted',providerId:result.groupInfo.groupId};
    return {status:'unknown',error:'접수 결과 확인이 필요합니다. 자동으로 재발송하지 않습니다.',providerId:result.groupInfo?.groupId};
  }catch{
    // SOLAPI has no verified idempotency contract in this adapter. Never blindly retry.
    return {status:'unknown',error:'발송 요청 결과가 불명확합니다. SOLAPI 발송 내역을 확인해 주세요.'};
  }
}
