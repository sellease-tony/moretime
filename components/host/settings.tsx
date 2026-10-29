"use client";
import {useEffect,useState} from 'react';
import {defaultReminders,type ReminderSettings} from '@/lib/notifications/reminders';
import {CalendarCheck,CalendarX,RefreshCw} from 'lucide-react';
import type {HostUser} from './use-workspace';
import {legal} from '@/lib/legal';
type Job={id:string;channel:string;recipient_role?:string;event_type:string;status:string;created_at:string};
type Status={reminders?:ReminderSettings;configured:boolean;mode:string;calendar?:boolean;calendarProvider?:'google'|'microsoft'|null;jobs?:Job[]};
// What a host needs to know about each email, without delivery-pipeline vocabulary.
const STATUS:Record<string,[string,'ok'|'wait'|'warn'|'muted']>={accepted:['보냄','ok'],pending:['보내는 중','wait'],processing:['보내는 중','wait'],failed:['보내지 못함','warn'],unknown:['보내지 못함','warn'],blocked:['보내지 못함','warn'],simulated:['테스트 · 발송 안 함','muted'],disabled:['보내지 않음','muted'],expired:['시간이 지나 생략','muted'],superseded:['일정 변경으로 생략','muted']};
const EVENTS:Record<string,string>={confirmed:'예약 확정 안내',cancelled:'예약 취소 안내',reminder_24h:'하루 전 리마인더',reminder_1h:'1시간 전 리마인더'};
const REMINDERS=[['reminder_24h','하루 전'],['reminder_1h','1시간 전']] as const;
const RECIPIENTS=[['guest','예약자'],['host','나(주최자)']] as const;

export default function HostSettings({user}:{user:HostUser}){
  const [status,S]=useState<Status|null>(null),[error,E]=useState(''),[syncing,SY]=useState(false),[syncMessage,SM]=useState('');
  const [reminders,R]=useState<ReminderSettings>(defaultReminders),[saving,SV]=useState(false),[message,M]=useState('');
  async function saveReminders(){SV(true);M('');try{const r=await fetch('/api/reminders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(reminders)});const d=await r.json();if(!r.ok)throw Error(d.error);M('저장했습니다.')}catch(e){M(e instanceof Error?e.message:'저장하지 못했습니다.')}finally{SV(false)}}
  async function syncCalendar(){SY(true);SM('');let cursor:string|null=null;let synced=0,failed=0;try{do{const r:Response=await fetch('/api/calendar/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cursor})});const d:{synced:number;failed:number;next:string|null;error?:string}=await r.json();if(!r.ok)throw Error(d.error);synced+=d.synced;failed+=d.failed;cursor=d.next;}while(cursor);SM(failed?`${failed}건을 캘린더에 반영하지 못했습니다. Google을 다시 연결한 뒤 한 번 더 눌러 주세요.`:synced?`예약 ${synced}건을 캘린더와 맞췄습니다.`:'캘린더가 이미 최신 상태입니다.')}catch(e){SM(e instanceof Error?e.message:'캘린더를 맞추지 못했습니다.')}finally{SY(false)}}
  async function load(){E('');try{const r=await fetch('/api/integrations');const d=await r.json();if(!r.ok)throw Error(d.error);S(d);R(d.reminders||defaultReminders)}catch(e){E(e instanceof Error?e.message:'설정을 불러오지 못했습니다.')}}
  useEffect(()=>{void load()},[]);
  const connected=status?.calendar;
  const jobs=(status?.jobs||[]).filter(j=>j.channel==='email').slice(0,10);
  return <div className="settings-page">
   <section className="panel settings-card"><h2>계정 및 캘린더</h2>
    <div className="integration">{status?.calendarProvider==='microsoft'?<span aria-hidden="true" className="ms-logo"><i/><i/><i/><i/></span>:<span className="google">G</span>}<div><h3>{user?.email||'내 계정'}</h3><p>{!status?'연결 상태 확인 중…':connected?<span className="state ok"><CalendarCheck size={15}/>캘린더 연결됨</span>:<span className="state warn"><CalendarX size={15}/>캘린더 연결이 필요합니다</span>}</p></div><a className={connected?'secondary-button':'primary'} href="/auth/reconnect">{connected?'다시 연결':'캘린더 연결'}</a></div>
    <p className="settings-help">내 캘린더의 바쁜 시간은 예약 가능 시간에서 자동으로 빠지고, 확정된 예약은 내 캘린더(Google 또는 Outlook)에 등록됩니다. 일정 제목이나 내용은 예약자에게 보이지 않습니다.</p>
    <div className="settings-row"><div><strong>예약이 캘린더에 안 보이나요?</strong><p>모아타임의 예약을 내 캘린더에 다시 맞춥니다.</p></div><button className="secondary-button" disabled={syncing||!connected} onClick={syncCalendar}><RefreshCw size={15}/>{syncing?'맞추는 중…':'캘린더 다시 맞추기'}</button></div>
    {syncMessage&&<p className="settings-message" role="status">{syncMessage}</p>}
   </section>

   <section className="panel settings-card"><h2>이메일 알림</h2><p className="settings-help">예약이 확정·변경·취소되면 예약자와 나에게 바로 이메일을 보냅니다.</p>
    {error&&<p className="settings-message" role="alert">{error} <button className="link-button" onClick={load}>다시 시도</button></p>}
    <fieldset disabled={!status||saving} className="settings-options"><legend>예약 전 리마인더</legend>
     <div>{REMINDERS.map(([key,label])=><label key={key}><input type="checkbox" checked={reminders[key]} onChange={e=>R({...reminders,[key]:e.target.checked})}/>{label}</label>)}</div>
     <p className="sub">받는 사람</p>
     <div>{RECIPIENTS.map(([key,label])=><label key={key}><input type="checkbox" checked={reminders[key]} onChange={e=>R({...reminders,[key]:e.target.checked})}/>{label}</label>)}</div>
     <div className="settings-actions"><button className="primary" onClick={saveReminders}>{saving?'저장 중…':'저장'}</button>{message&&<span role="status">{message}</span>}</div>
    </fieldset>
   </section>

   <section className="panel settings-card"><div className="settings-title"><h2>최근 보낸 알림</h2><button onClick={load} aria-label="새로고침"><RefreshCw size={17}/></button></div>
    {!status?<p role="status">불러오는 중…</p>:!jobs.length?<p className="settings-help">아직 보낸 알림이 없습니다.</p>:<ul className="sent-list">{jobs.map(j=>{const [label,tone]=STATUS[j.status]||['확인 중','wait'];return <li key={j.id}><div><strong>{EVENTS[j.event_type]||'예약 안내'}</strong><small>{j.recipient_role==='host'?'나에게':'예약자에게'} · {new Date(j.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</small></div><span className={'state '+tone}>{label}</span></li>})}</ul>}
   </section>

   <section className="panel settings-card"><h2>계정</h2>
    <div className="settings-row"><div><strong>로그아웃</strong><p>이 기기에서 모아타임 로그아웃합니다.</p></div><button className="secondary-button" onClick={async()=>{await fetch('/auth/logout',{method:'POST'});location.assign('/')}}>로그아웃</button></div>
    <div className="settings-row"><div><strong>도움이 필요하신가요?</strong><p>문의나 회원 탈퇴는 고객센터로 연락해 주세요.</p></div><a className="secondary-button" href={'mailto:'+legal.contactEmail}>{legal.contactEmail}</a></div>
   </section>
  </div>;
}
