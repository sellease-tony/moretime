'use client';
import {useEffect,useState} from 'react';
import EventEditor from './event-editor';
import {rankSlots,type Poll} from '@/lib/polls/model';

type Draft=Parameters<React.ComponentProps<typeof EventEditor>['onSave']>[0];
export default function PollDetails({id,hours,range,onChanged,onBusyChange}:{id:string;hours:boolean[];range:string[];onChanged:(poll:Poll)=>void;onBusyChange:(busy:boolean)=>void}){
 const [poll,P]=useState<Poll|null>(null),[editing,E]=useState(false),[busy,B]=useState(false),[loading,L]=useState(true),[message,M]=useState('');
 const [pending,PN]=useState<{action:'confirm'|'cancel';slot?:string;revision:number}|null>(null);
 async function request(init?:RequestInit){
  const r=await fetch('/api/polls/'+id,{cache:'no-store',signal:AbortSignal.timeout(60000),...init});
  const d=await r.json();if(!r.ok)throw Error(d.error||'처리하지 못했습니다.');return d;
 }
 async function refresh(){const d=await request();P(d.poll);return d.poll as Poll}
 useEffect(()=>{let active=true;L(true);request().then(d=>{if(active)P(d.poll)}).catch(e=>{if(active)M(e.message)}).finally(()=>{if(active)L(false)});return()=>{active=false}},[id]);
 useEffect(()=>{onBusyChange(busy);return()=>onBusyChange(false)},[busy,onBusyChange]);
 useEffect(()=>{
  if(editing||busy||pending)return;
  let active=true;
  const timer=setInterval(()=>{if(document.visibilityState==='visible')request().then(d=>{if(active)P(d.poll)}).catch(()=>{})},15000);
  return()=>{active=false;clearInterval(timer)};
 },[id,editing,busy,pending]);
 async function mutate(body:unknown){
  B(true);M('');
  try{await request({method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const updated=await refresh();onChanged(updated);M('저장했습니다.');return true}
  catch(e){M(e instanceof Error?e.message:'처리하지 못했습니다.');try{await refresh()}catch{}return false}
  finally{B(false)}
 }
 async function addCandidates(e:Draft){
  if(!poll)return false;
  const candidates=Object.entries(e.availability?.days||{}).flatMap(([day,times])=>times.map(t=>day+'T'+t));
  const ok=await mutate({action:'add',revision:poll.revision,poll:{title:poll.title,description:poll.description,duration:poll.duration,meeting_mode:poll.meeting_mode,expected_count:poll.expected_count,candidates}});
  if(ok)E(false);return ok;
 }
 const responses=poll?.responses||[],ranked=poll?rankSlots(poll.candidates,responses):[];
 return <div className="poll-workspace poll-detail">
  {loading&&<p role="status">응답을 불러오는 중…</p>}
  {message&&<p className="notice" role="status">{message}</p>}
  {!poll&&!loading&&<button className="edit-availability" onClick={()=>{L(true);refresh().catch(e=>M(e.message)).finally(()=>L(false))}}>다시 불러오기</button>}
  {poll&&<><span className="tag">여러 명 일정 투표</span><h2>{poll.title}</h2>
   {editing?<><button className="edit-availability" disabled={busy} onClick={()=>E(false)}>← 응답 결과로 돌아가기</button><p>기존 응답을 유지하면서 후보 시간만 추가합니다.</p><EventEditor purpose="poll" candidateLimit={200-poll.candidates.length} initial={{id:poll.id,title:poll.title,desc:poll.description,duration:poll.duration,color:'blue',team:false,active:true,availability:{days:{},includeWeekends:false,includeLunch:false,source:'manual',updatedAt:new Date().toISOString(),meetingMode:poll.meeting_mode}}} team={false} hours={hours} range={range} busy={busy} onSave={addCandidates}/></>:<>
    <p>{poll.duration}분 · {poll.meeting_mode==='offline'?'오프라인':'온라인'} · 한국시간</p>
    <label className="poll-share">참석자에게 보낼 링크<input readOnly value={typeof location==='undefined'?'':location.origin+'/poll/'+id} onFocus={e=>e.target.select()}/></label>
    <p><strong>{responses.length}명 응답 / 예상 {poll.expected_count}명</strong></p>
    {poll.status==='confirmed'&&<p className="notice">확정: {poll.selected_slot?.replace('T',' ')} · 캘린더 등록과 참석자 이메일 발송을 요청했습니다.</p>}
    {poll.status==='cancelled'&&<p className="notice">종료된 모임입니다.</p>}
    <details><summary>참석자 응답 확인 ({responses.length}명)</summary>{responses.length?responses.map(r=><p key={r.id}><strong>{r.name}</strong> · {r.email}<br/>{r.choices.length?r.choices.map(s=>s.replace('T',' ')).join(', '):'가능한 시간 없음'}</p>):<p>아직 응답이 없습니다. 링크를 참석자에게 공유해 주세요.</p>}</details>
    {poll.status==='open'&&<>
     <p>참석 가능한 인원이 많은 순서입니다. 예상 인원 이상이 응답하고 모두 가능한 시간만 확정할 수 있습니다.</p>
     <div className="poll-results">{ranked.map(r=><div className="poll-result" key={r.slot}><span>{r.slot.replace('T',' ')}<br/><strong>{r.count} / {responses.length}명 가능</strong></span><button className="primary" disabled={busy||responses.length<poll.expected_count||r.count!==responses.length||new Date(r.slot+':00+09:00')<=new Date()} onClick={()=>PN({action:'confirm',slot:r.slot,revision:poll.revision})}>이 시간 확정</button></div>)}</div>
     <button className="edit-availability" disabled={busy||poll.candidates.length>=200} onClick={()=>{E(true);M('')}}>후보 시간 추가</button>
    </>}
    {poll.status!=='cancelled'&&<button className="delete-page" disabled={busy} onClick={()=>PN({action:'cancel',revision:poll.revision})}>{poll.status==='confirmed'?'확정 모임 취소':'투표 종료'}</button>}
   </>}
   {pending&&<section className="notice poll-confirm" role="alertdialog" aria-label="모임 처리 확인"><h3>{pending.action==='confirm'?'이 시간으로 확정할까요?':'이 모임을 종료할까요?'}</h3><p>{pending.slot?.replace('T',' ')}</p><p>{pending.action==='confirm'?'주최자의 일정을 다시 확인하고, 확정 후 참석자에게 알립니다.':'확정된 모임이면 참석자에게 취소 알림이 발송됩니다.'}</p><div className="manage-actions"><button autoFocus disabled={busy} onClick={()=>PN(null)}>돌아가기</button><button className="primary" disabled={busy} onClick={async()=>{await mutate(pending);PN(null)}}>{busy?'처리 중…':pending.action==='confirm'?'확정하고 알림 보내기':'모임 종료하기'}</button></div></section>}
  </>}
 </div>
}
