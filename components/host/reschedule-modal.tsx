"use client";
import {useState} from 'react';
import {displayMeeting} from '@/lib/bookings/meeting';
import {kstDay} from '@/lib/availability';
import type {HostBooking} from './use-workspace';
// Host moves a confirmed booking to a time agreed with the guest (e.g. by phone). The new time may be outside
// the page's open slots; other bookings still block it, and a Google Calendar clash asks for confirmation.
// While that warning is up the main button itself confirms; changing the date or time clears it and re-checks.
export default function RescheduleModal({booking,busy,onBusy,onDone}:{booking:HostBooking;busy:boolean;onBusy:(b:boolean)=>void;onDone:(message:string)=>void}){
 const [day,setDay]=useState<string>(booking.day),[time,setTime]=useState<string>(booking.time);
 // One id per attempt, reused on retries so a lost response never creates two bookings.
 const [requestId]=useState(()=>crypto.randomUUID());
 const [error,setError]=useState(''),[warning,setWarning]=useState('');
 const changed=day!==booking.day||time!==booking.time;
 async function submit(force=false){
  onBusy(true);setError('');
  try{
   const r=await fetch(`/api/bookings/${booking.id}/reschedule`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({day,time,requestId,force}),signal:AbortSignal.timeout(30000)});
   const d=await r.json();
   if(d.warning){setWarning(d.warning);return}
   if(!r.ok)throw Error(d.error||'일정을 변경하지 못했습니다.');
   onDone(d.mode==='live'?'일정을 변경하고 예약자에게 변경 안내 메일을 보냈습니다.':'일정을 변경했습니다. 현재 알림 모드에서는 메일이 실제로 발송되지 않습니다.');
  }catch(e){setError(e instanceof Error&&e.name!=='TimeoutError'?e.message:'응답이 지연되고 있습니다. 다시 누르면 중복 없이 처리 여부를 확인합니다.')}
  finally{onBusy(false)}
 }
 return <form className="reschedule" onSubmit={e=>{e.preventDefault();void submit(!!warning)}}>
  <span className="eyebrow">RESCHEDULE</span>
  <h2>예약 일정 변경</h2>
  <div className="reschedule-current"><strong>{displayMeeting(booking)}</strong><p>{booking.name} · {booking.email}</p><p>현재: {booking.day} {booking.time} · {booking.duration}분</p></div>
  <div className="reschedule-fields">
   <label>날짜<input type="date" required min={kstDay()} value={day} disabled={busy} onChange={e=>{setDay(e.target.value);setWarning('')}}/></label>
   <label>시작 시간<input type="time" required step={300} value={time} disabled={busy} onChange={e=>{setTime(e.target.value);setWarning('')}}/></label>
  </div>
  <p className="reschedule-help">예약자와 협의한 시간이라면 열어 둔 가능 시간이 아니어도 변경할 수 있습니다. 다른 예약과 겹치는 시간은 선택할 수 없습니다.</p>
  <div className="notice">변경하면 예약자와 주최자에게 &lsquo;예약 변경&rsquo; 메일이 가고, Google 캘린더 일정도 새 시간으로 옮겨집니다. 예약자가 가진 기존 관리 링크는 더 이상 쓸 수 없고, 새 메일의 링크를 쓰게 됩니다.</div>
  {warning&&<div className="notice reschedule-warning" role="alert"><p>{warning}</p><p>다른 시간으로 바꾸려면 날짜나 시작 시간을 다시 고르세요.</p></div>}
  {error&&<p className="notice" role="alert">{error}</p>}
  <button className="primary full" disabled={busy||!changed||!day||!time}>{busy?'변경 중…':warning?'겹쳐도 이 시간으로 변경하기':'일정 변경하기'}</button>
 </form>;
}
