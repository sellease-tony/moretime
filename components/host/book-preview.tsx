"use client";
import {useState,useEffect} from 'react';
import {Clock3,ChevronRight,ChevronLeft,Video,Globe} from 'lucide-react';
import type {HostEvent} from './use-workspace';
// Host-side preview of a booking page; the host can also book a slot directly.
// Mounted with key={event.id}, so date and slot state reset whenever another page is previewed.
export default function BookPreview({event,mode,busy,onBook}:{event:HostEvent;mode:string;busy:boolean;onBook:(b:{day:string;time:string;name:string;email:string;phone:string;company:string})=>void}){
 const [day,setDay]=useState(''),[time,setTime]=useState('');
 const [month,setMonth]=useState(new Date().getMonth()),[year,setYear]=useState(new Date().getFullYear());
 const [slots,setSlots]=useState<string[]>([]),[slotError,setSlotError]=useState(''),[slotLoading,setSlotLoading]=useState(false);
 useEffect(()=>{if(!day)return;const controller=new AbortController();setSlotLoading(true);setSlots([]);setSlotError('');setTime('');fetch('/api/availability?eventId='+encodeURIComponent(event.id)+'&day='+day,{signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);return d}).then(d=>setSlots(d.slots)).catch(e=>{if(e.name!=='AbortError')setSlotError(e.message)}).finally(()=>{if(!controller.signal.aborted)setSlotLoading(false)});return ()=>controller.abort()},[day,event.id]);
 const shiftMonth=(delta:number)=>{const d=new Date(year,month+delta,1);setMonth(d.getMonth());setYear(d.getFullYear());setDay('')};
 const today=new Date(new Date().setHours(0,0,0,0));
 return <div className="booklayout"><div className="bookinfo"><span className="avatar">나</span><p>모아타임</p><h2>{event.title}</h2><p>{event.desc}</p><span><Clock3 size={17}/>{event.duration}분</span><span><Video size={17}/>{event.availability?.meetingMode==='offline'?'오프라인 · 전후 1시간':'온라인 미팅'}</span><span><Globe size={17}/>Asia/Seoul</span><div className="notice">{mode==='live'?'예약 확정·취소 시 예약자와 주최자에게 이메일을 보냅니다.':'알림 발송은 '+(mode==='dry-run'?'모의 발송':'꺼짐')+' 상태입니다. 실제 메시지는 발송되지 않습니다.'}</div></div>
  <div className="datepick"><h3>날짜와 시간을 선택하세요</h3>{!event.active?<p>현재 예약을 받고 있지 않습니다.</p>:<>
   <div className="month"><button aria-label="이전 달" onClick={()=>shiftMonth(-1)}><ChevronLeft/></button><strong>{year}년 {month+1}월</strong><button aria-label="다음 달" onClick={()=>shiftMonth(1)}><ChevronRight/></button></div>
   <div className="calendar">{['일','월','화','수','목','금','토'].map(d=><small key={d}>{d}</small>)}{Array.from({length:new Date(year,month,1).getDay()},(_,i)=><span key={'x'+i}/>)}{Array.from({length:new Date(year,month+1,0).getDate()},(_,i)=>{const date=new Date(year,month,i+1),ds=`${year}-${String(month+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;return <button key={i} disabled={!event.availability?.days[ds]?.length||date<today} className={day===ds?'picked':''} onClick={()=>{setDay(ds);setTime('')}}>{i+1}</button>})}</div>
   {day&&<><p>{day} · 가능한 시간</p>{slotLoading&&<p role="status">저장된 가능 시간 확인 중…</p>}{slotError&&<p role="alert">{slotError}</p>}{!slotLoading&&!slotError&&!slots.length&&<p>예약 가능한 시간이 없습니다.</p>}<div className="slots">{slots.map(t=><button key={t} className={t===time?'picked':''} onClick={()=>setTime(t)}>{t}</button>)}</div></>}
   {day&&time&&<form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);onBook({day,time,name:String(f.get('name')||''),email:String(f.get('email')||''),phone:String(f.get('phone')||''),company:String(f.get('company')||'')})}}>{event.companyMode&&event.companyMode!=='hidden'&&<label>회사명<input name="company" required={event.companyMode==='required'} maxLength={80}/></label>}<label>이름<input name="name" required maxLength={80}/></label><label>이메일<input name="email" type="email" required maxLength={200}/></label><label>휴대전화 (선택)<input name="phone" type="tel" placeholder="01012345678"/></label><fieldset className="channel-options"><legend>예약 알림</legend><p>이메일은 예약자·주최자 양쪽에 발송합니다.</p><label><input type="checkbox" name="consent" required/>입력한 수신자의 예약 확정·취소 알림 수신을 확인했습니다.</label></fieldset><button className="primary full" disabled={busy||slotLoading||!!slotError}>예약 확정</button></form>}
  </>}</div></div>;
}
