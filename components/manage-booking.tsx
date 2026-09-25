'use client';
import {useEffect,useState} from 'react';
import {CalendarDays} from 'lucide-react';
import AvailabilityCalendar from './availability-calendar';
import {kstDay} from '@/lib/availability';
type Data={booking:{title:string;name:string;day:string;time:string;duration:number;status:string};canManage:boolean;canReschedule:boolean;days:Record<string,string[]>;token:string};
export default function ManageBooking(){
 const [token,TOKEN]=useState(''),[data,D]=useState<Data|null>(null),[month,M]=useState(kstDay().slice(0,7)),[day,DAY]=useState(''),[time,T]=useState(''),[action,A]=useState<'cancel'|'reschedule'|null>(null),[error,E]=useState(''),[message,MSG]=useState(''),[loading,L]=useState(true),[saving,S]=useState(false),[revision,R]=useState(0),[requestId,ID]=useState('');
 useEffect(()=>{const t=new URLSearchParams(location.hash.slice(1)).get('token')||'';TOKEN(t);ID(crypto.randomUUID());if(!t){E('확인 이메일에 있는 예약 관리 링크로 접속해 주세요.');L(false)}},[]);
 useEffect(()=>{
  if(!token)return;const controller=new AbortController();L(true);
  fetch('/api/booking-management?month='+month,{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);return d as Data}).then(d=>{D(d);if(d.token!==token){TOKEN(d.token);history.replaceState(null,'','#token='+d.token)}DAY(old=>d.days[old]?.length?old:Object.keys(d.days).find(k=>d.days[k].length)||'');E('')}).catch(e=>{if(e.name!=='AbortError')E(e.message)}).finally(()=>{if(!controller.signal.aborted)L(false)});
  return ()=>controller.abort();
 },[token,month,revision]);
 useEffect(()=>{if(time&&!data?.days[day]?.includes(time))T('')},[data,day,time]);
 useEffect(()=>{const refresh=()=>{if(document.visibilityState==='visible'&&!saving)R(v=>v+1)};const timer=setInterval(refresh,20000);window.addEventListener('focus',refresh);return ()=>{clearInterval(timer);window.removeEventListener('focus',refresh)}},[saving]);
 async function submit(){
  if(!action)return;S(true);E('');
  try{
   const r=await fetch('/api/booking-management',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action,day,time,requestId})});
   const d=await r.json();if(!r.ok){if(r.status===409){R(v=>v+1);T('')}throw Error(d.error)}
   TOKEN(d.token);history.replaceState(null,'','#token='+d.token);MSG(action==='cancel'?'예약을 취소했습니다.':'예약 시간을 변경했습니다.');A(null);T('');ID(crypto.randomUUID());R(v=>v+1);
  }catch(e){E(e instanceof Error?e.message:'처리하지 못했습니다. 다시 시도해 주세요.')}finally{S(false)}
 }
 return <div className="public-booking"><a className="brand" href="/"><span className="logo"><CalendarDays/></span>모아타임.</a><section className="panel public-panel public-calendar-panel"><span className="tag">YOUR BOOKING</span><h1>예약 변경·취소</h1>
 {message&&<div className="notice" role="status">{message} 이메일 알림과 주최자 캘린더 반영을 진행합니다.</div>}
 {error&&<div className="notice" role="alert">{error}{token&&<button onClick={()=>R(v=>v+1)}>다시 확인</button>}</div>}
 {loading&&!data&&<p role="status">예약을 확인하는 중…</p>}
 {data&&<><h2 style={{marginTop:24}}>{data.booking.title}</h2><p>{data.booking.name}님 · {data.booking.day} {data.booking.time}<br/>{data.booking.duration}분 · 한국시간 (Asia/Seoul)</p>
 {data.booking.status==='cancelled'?<div className="notice">취소된 예약입니다.</div>:!data.canManage?<div className="notice">이미 시작되거나 완료된 예약입니다. 변경·취소는 주최자에게 문의해 주세요.</div>:<><p>예약 시작 전까지 변경·취소할 수 있습니다.</p><div className="manage-actions"><button className="primary" disabled={!data.canReschedule||saving||loading} onClick={()=>{A('reschedule');MSG('');E('')}}>시간 변경</button><button className="authbutton" disabled={saving||loading} onClick={()=>{A('cancel');MSG('');E('')}}>예약 취소</button></div>
 {!data.canReschedule&&<p>주최자가 현재 시간 변경을 받고 있지 않습니다. 예약 취소는 가능합니다.</p>}
 {action==='reschedule'&&<><h2 className="booking-step-title">변경할 날짜와 시간</h2><p>새 시간이 확정되기 전까지 기존 예약은 유지됩니다.</p><div className="guest-calendar-grid"><AvailabilityCalendar month={month} onMonth={v=>{M(v);DAY('');T('')}} day={day} onDay={v=>{DAY(v);T('')}} days={data.days} loading={loading||saving}/><div className="guest-times"><h3>{day||'예약 가능한 날짜가 없습니다'}</h3><div className="slots">{(data.days[day]||[]).map(t=><button key={t} disabled={loading||saving} className={t===time?'picked':''} aria-pressed={t===time} onClick={()=>{T(t);ID(crypto.randomUUID())}}>{t}</button>)}</div></div></div>{time&&<div className="notice">{data.booking.day} {data.booking.time} → <strong>{day} {time}</strong><br/>위 시간으로 예약을 변경합니다.</div>}<button className="primary full" disabled={!time||loading||saving} onClick={submit}>{saving?'변경 중…':'이 시간으로 변경 확정'}</button></>}
 {action==='cancel'&&<div className="notice"><h3>예약을 취소하시겠어요?</h3><p>{data.booking.day} {data.booking.time} 예약이 취소되고 주최자에게 알림이 전송됩니다. 취소 후에는 다시 예약해야 합니다.</p><div className="manage-actions"><button className="authbutton" disabled={saving} onClick={()=>A(null)}>예약 유지</button><button className="primary" disabled={saving} onClick={submit}>{saving?'취소 중…':'취소 확정'}</button></div></div>}</>}
 </>}
 <p className="footnote">이 링크를 가진 사람은 예약을 관리할 수 있습니다. 다른 사람에게 공유하지 마세요.</p></section></div>;
}
