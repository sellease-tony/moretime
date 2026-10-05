'use client';
import {useEffect,useRef,useState} from 'react';
import AvailabilityCalendar from './availability-calendar';
import {kstDay} from '@/lib/availability';
import type {Poll} from '@/lib/polls/model';

type Credential={id:string;key:string};
type ResponseData={name:string;email:string;choices:string[]};
export default function PollPage({id}:{id:string}){
 const [poll,P]=useState<Poll|null>(null),[choices,C]=useState<string[]>([]),[name,N]=useState(''),[email,EM]=useState('');
 const [credential,K]=useState<Credential|null>(null),[busy,B]=useState(false),[loading,L]=useState(true),[message,M]=useState('');
 const [saved,S]=useState<ResponseData|null>(null),[editing,E]=useState(false),[none,NO]=useState(false),[consent,CO]=useState(false),[revision,R]=useState(0);
 const [day,D]=useState(''),[month,MO]=useState(kstDay().slice(0,7));
 const hydrated=useRef('');
 useEffect(()=>{
  try{
   const hash=new URLSearchParams(location.hash.slice(1)),raw=localStorage.getItem('moa-vote-'+id);
   const value=hash.has('key')?{id:hash.get('response'),key:hash.get('key')}:raw?JSON.parse(raw):null;
   const valid=(s:unknown)=>typeof s==='string'&&/^[a-f0-9-]{36}$/.test(s);
   K(value&&valid(value.id)&&valid(value.key)?value:{id:crypto.randomUUID(),key:crypto.randomUUID()});
  }catch{K({id:crypto.randomUUID(),key:crypto.randomUUID()})}
 },[id]);
 useEffect(()=>{
  if(!credential)return;
  const c=new AbortController();L(true);
  fetch('/api/poll/'+id,{headers:{'x-response-id':credential.id,'x-response-key':credential.key},cache:'no-store',signal:AbortSignal.any([c.signal,AbortSignal.timeout(20000)])})
   .then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'투표를 불러오지 못했습니다.');return d})
   .then(d=>{
    P(d.poll);
    // Refresh the poll without replacing an attendee's unsaved draft.
    if(hydrated.current!==credential.id){
     hydrated.current=credential.id;
     const response=d.response as ResponseData|null;
     N(response?.name||'');EM(response?.email||'');C(response?.choices||[]);S(response);NO(!!response&&!response.choices.length);CO(!!response);E(!response);
     const first=d.poll.candidates.find((s:string)=>new Date(s+':00+09:00')>new Date());
     D(first?.slice(0,10)||'');MO(first?.slice(0,7)||kstDay().slice(0,7));
    }
   }).catch(e=>{if(!c.signal.aborted)M(e.name==='TimeoutError'?'불러오기가 지연됩니다. 다시 시도해 주세요.':e.message)})
   .finally(()=>{if(!c.signal.aborted)L(false)});
  return ()=>c.abort();
 },[id,credential,revision]);
 async function save(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!credential||busy)return;
  if(!choices.length&&!none){M('가능한 시간을 선택하거나 ‘가능한 시간 없음’을 선택해 주세요.');return}
  B(true);M('');
  try{
   try{localStorage.setItem('moa-vote-'+id,JSON.stringify(credential))}catch{}
   const r=await fetch('/api/poll/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...credential,name,email,choices,consent}),signal:AbortSignal.timeout(20000)});
   const d=await r.json();if(!r.ok)throw Error(d.error);
   S({name,email,choices:[...choices]});E(false);M('응답을 저장했습니다. 모임 확정 시 이메일로 알려드립니다.');
  }catch(e){M(e instanceof Error?e.message:'저장하지 못했습니다. 다시 시도해 주세요.');R(n=>n+1)}finally{B(false)}
 }
 function newParticipant(){
  K({id:crypto.randomUUID(),key:crypto.randomUUID()});N('');EM('');C([]);S(null);NO(false);CO(false);E(true);M('새 참석자의 응답입니다. 이전 참석자의 응답은 유지됩니다.');
  history.replaceState(null,'',location.pathname);
 }
 const days:Record<string,string[]>={};
 for(const s of poll?.candidates||[])if(new Date(s+':00+09:00')>new Date())(days[s.slice(0,10)]??=[]).push(s.slice(11));
 return <main className="public-booking poll-public"><a className="brand" href="/">모아타임.</a><section className="panel public-panel">
  <span className="tag">여러 명 일정 투표</span><h1>{poll?.title||'일정 투표'}</h1>
  {message&&<p className="notice" role="status">{message}</p>}
  {loading&&<p role="status">투표를 불러오는 중…</p>}
  <button className="edit-availability" disabled={busy||loading} onClick={()=>{M('');R(n=>n+1)}}>최신 투표 확인</button>
  {poll&&<><p>{poll.description}</p><p>{poll.duration}분 · {poll.meeting_mode==='offline'?'오프라인':'온라인'} · 한국시간</p>
   {poll.status==='confirmed'?<div className="notice"><h2>모임 시간이 확정되었습니다</h2><p>{poll.selected_slot?.replace('T',' ')}</p></div>:poll.status==='cancelled'?<p className="notice">종료되거나 취소된 모임입니다.</p>:<>
    {saved&&!editing?<div className="poll-response-summary"><h2>{saved.name}님의 응답이 저장되었습니다</h2><p>확정 알림: {saved.email}</p><ul>{saved.choices.length?saved.choices.map(s=><li key={s}>{s.replace('T',' ')}</li>):<li>가능한 시간 없음</li>}</ul><p>아직 예약이 확정된 것은 아닙니다. 주최자가 공통 시간을 확인해 확정합니다.</p><button className="primary" onClick={()=>{E(true);M('')}}>내 응답 수정하기</button></div>:<form className="public-form poll-form" onSubmit={save}>
     <h2>가능한 시간을 모두 선택해 주세요</h2><p>날짜를 바꿔도 선택은 유지됩니다. 게스트의 Google 로그인이나 캘린더 연결은 필요하지 않습니다.</p>
     <fieldset disabled={busy||loading}>
      <div className="guest-calendar-grid"><AvailabilityCalendar month={month} onMonth={MO} day={day} onDay={D} days={days}/><div className="guest-times"><h3>{day||'남은 후보 시간이 없습니다'}</h3><div className="slots">{(days[day]||[]).map(time=>{const slot=day+'T'+time;return <button type="button" key={slot} aria-pressed={choices.includes(slot)} className={choices.includes(slot)?'picked':''} onClick={()=>{NO(false);C(prev=>prev.includes(slot)?prev.filter(s=>s!==slot):[...prev,slot].sort())}}>{time}</button>})}</div><p>한 날짜에서 여러 시간을 선택할 수 있습니다.</p></div></div>
      <div className="poll-selection"><strong>선택한 시간 {choices.length}개</strong><div>{choices.map(s=><button type="button" key={s} aria-label={s.replace('T',' ')+' 선택 취소'} onClick={()=>C(prev=>prev.filter(v=>v!==s))}>{s.replace('T',' ')} ×</button>)}</div></div>
      <label className="poll-check"><input type="checkbox" checked={none} onChange={e=>{NO(e.target.checked);if(e.target.checked)C([])}}/>가능한 시간 없음</label>
      <div className="poll-contact"><label>이름<input required maxLength={80} value={name} onChange={e=>N(e.target.value)} autoComplete="name"/></label><label>확정 알림 이메일<input required type="email" maxLength={200} value={email} onChange={e=>EM(e.target.value)} autoComplete="email"/></label></div>
      <label className="poll-check"><input type="checkbox" required checked={consent} onChange={e=>CO(e.target.checked)}/>응답 저장 및 모임 확정·취소 이메일 수신에 동의합니다.</label>
      <button className="primary full" disabled={!credential||(!choices.length&&!none)}>{busy?'저장 중…':saved?'수정한 응답 저장':'응답 제출'}</button>
     </fieldset>
    </form>}
   </>}
   {saved&&credential&&<div className="notice"><p>본인 응답 수정 링크를 보관해 주세요. 이 링크에는 응답 수정 권한이 있으므로 다른 사람에게 공유하지 마세요.</p><button className="edit-availability" onClick={async()=>{try{await navigator.clipboard.writeText(location.origin+'/poll/'+id+'#response='+credential.id+'&key='+credential.key);M('본인 응답 수정 링크를 복사했습니다.')}catch{M('링크를 복사하지 못했습니다.')}}}>내 응답 수정 링크 복사</button>{poll.status==='open'&&<button className="edit-availability" disabled={busy||loading} onClick={newParticipant}>다른 참석자로 응답하기</button>}</div>}
  </>}
 </section></main>
}
