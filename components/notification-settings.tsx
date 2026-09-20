"use client";
import {useEffect,useState} from 'react';
import {Mail,MessageSquare,MessageCircle,RefreshCw} from 'lucide-react';
type Status={configured:boolean;mode:string;email?:boolean;sms?:boolean;kakao?:boolean;calendar?:boolean;scheduler?:boolean;jobs?:Array<{id:string;channel:string;recipient_role?:string;event_type:string;status:string;last_error?:string;created_at:string}>};
const names:Record<string,string>={pending:'발송 대기',processing:'접수 요청 중',accepted:'공급자 접수',failed:'실패',unknown:'확인 필요',simulated:'모의 발송',disabled:'발송 꺼짐',expired:'기한 만료',superseded:'취소로 생략',blocked:'연결 필요'};
export default function NotificationSettings(){
  const [status,S]=useState<Status|null>(null),[error,E]=useState('');
  async function load(){E('');try{const r=await fetch('/api/integrations');const d=await r.json();if(!r.ok)throw Error(d.error);S(d)}catch(e){E(e instanceof Error?e.message:'연결 상태를 확인하지 못했습니다.')}}
  useEffect(()=>{void load()},[]);
  return <section className="panel notification-panel"><div className="notification-title"><div><h2>예약 알림</h2><p>예약 확정·취소 시 선택한 채널로 알림을 보냅니다.</p></div><button onClick={load} aria-label="알림 상태 새로고침"><RefreshCw size={18}/></button></div>{error&&<p role="alert">{error}</p>}
    <div className="notice">Google 캘린더: <strong>{status?.calendar?'연결 정보 저장됨':'연결 필요'}</strong><br/>발송 모드: <strong>{status?.mode==='live'?'실제 발송':status?.mode==='dry-run'?'모의 발송 (수신자에게 전송하지 않음)':'발송 꺼짐'}</strong></div>
    {([[Mail,'email','이메일','Resend · 발신 도메인 인증'],[MessageSquare,'sms','문자','SOLAPI · 발신번호 등록'],[MessageCircle,'kakao','카카오 알림톡','SOLAPI · 비즈니스 채널·승인 템플릿']] as const).map(([Icon,key,title,desc])=><div className="integration" key={key}><Icon/><div><h3>{title}</h3><p>{desc}</p></div><span className="pill">{status?.[key]?'연결값 설정됨':'연결값 필요'}</span></div>)}
    <p className="notification-help">연결값 설정 여부만 표시합니다. 도메인·발신번호·카카오 템플릿 승인 여부는 각 서비스에서 확인하세요. 문자와 알림톡을 모두 선택하면 각각 발송되며, 알림톡 실패 시 문자 자동 대체발송은 꺼져 있습니다.</p>
    <h3>최근 발송 내역</h3><p>‘공급자 접수’는 발송 요청을 접수했다는 뜻입니다. 최종 수신 결과는 공급자 콘솔에서 확인하세요.</p>
    {!status?.jobs?.length?<p>아직 발송 내역이 없습니다.</p>:<div className="notification-history">{status.jobs.map(j=><div key={j.id}><span>{j.channel==='email'?'이메일':j.channel==='sms'?'문자':'알림톡'} · {j.event_type==='confirmed'?'예약 확정':'예약 취소'} · {j.recipient_role==='host'?'주최자':'예약자'}</span><strong>{names[j.status]||j.status}</strong><small>{new Date(j.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</small>{j.last_error&&<p>{j.last_error}</p>}</div>)}</div>}
  </section>
}
