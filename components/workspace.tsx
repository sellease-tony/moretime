"use client";
import {useState,useEffect} from 'react';
import {Plus,X,Check,Globe} from 'lucide-react';
import PollDetails from '@/components/polls';
import type {Poll} from '@/lib/polls/model';
import BookingsCalendar from '@/components/bookings-calendar';
import {bookingStatus} from '@/lib/bookings/status';
import EventEditor from '@/components/event-editor';
import {useWorkspace,seed,type HostEvent} from '@/components/host/use-workspace';
import {Sidebar,AppHeader,subtitle,type View} from '@/components/host/chrome';
import PagesView,{type KindFilter} from '@/components/host/pages-view';
import {HoursView,SettingsView} from '@/components/host/simple-views';
import BookPreview from '@/components/host/book-preview';
import {InviteLinkModal,DeletePageModal,LoginModal,BookedModal} from '@/components/host/small-modals';
type Modal=''|'create'|'edit'|'book'|'poll'|'invite'|'delete'|'login'|'success';
type SaveEvent=Parameters<React.ComponentProps<typeof EventEditor>['onSave']>[0];

export default function Home(){
 const [view,setView]=useState<View>('예약 페이지');
 const [modal,setModal]=useState<Modal>(''),[item,setItem]=useState<HostEvent>(seed[0]);
 const [query,setQuery]=useState(''),[kind,setKind]=useState<KindFilter>('all');
 const [creationKind,setCreationKind]=useState<'booking'|'poll'>('booking'),[expected,setExpected]=useState(2),[createError,setCreateError]=useState('');
 const [booked,setBooked]=useState({day:'',time:''});
 const ws=useWorkspace({view,paused:!!modal});
 const {events,bookings,busy,user,setup,mode,calendarSync,now}=ws;
 const save=(data:Record<string,unknown>)=>ws.save(data,()=>setModal('login'));
 const openModal=(m:Modal,e?:HostEvent)=>{if(e)setItem(e);setModal(m)};
 const close=()=>setModal('');

 // Deep link: /app?book=<eventId> opens that page's preview once the workspace has loaded.
 useEffect(()=>{if(!ws.ready)return;const id=new URLSearchParams(location.search).get('book');if(id)openModal('book',events.find(e=>e.id===id)||seed[0])},[ws.ready]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(!modal||busy)return;const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')close()};document.addEventListener('keydown',onKey);return ()=>document.removeEventListener('keydown',onKey)},[modal,busy]);

 function createMeeting(){setCreationKind('booking');setExpected(2);setCreateError('');setModal('create')}
 async function createPoll(event:SaveEvent){
  ws.setBusy(true);setCreateError('');
  try{
   if(!Number.isInteger(expected)||expected<1||expected>100)throw Error('예상 참석 인원은 1~100명으로 입력해 주세요.');
   const candidates=Object.entries(event.availability?.days||{}).flatMap(([day,times])=>times.map(t=>day+'T'+t));
   const r=await fetch('/api/polls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:event.title,description:event.desc,duration:event.duration,meeting_mode:event.availability?.meetingMode||'online',expected_count:expected,candidates}),signal:AbortSignal.timeout(60000)});
   const d=await r.json();if(!r.ok)throw Error(d.error||'일정을 저장하지 못했습니다.');
   ws.setPolls(prev=>[d.poll,...prev.filter(p=>p.id!==d.poll.id)]);setKind('all');setQuery('');close();ws.notify('여러 명 일정을 만들었습니다. 카드에서 링크를 공유해 주세요.');return true;
  }catch(e){setCreateError(e instanceof Error?e.message:'저장하지 못했습니다.');return false}finally{ws.setBusy(false)}
 }
 async function saveEvent(event:SaveEvent){
  if(modal==='create'&&creationKind==='poll')return createPoll(event);
  const ok=await save({events:modal==='edit'?events.map(e=>e.id===event.id?event:e):[...events,event]});
  if(ok){close();setKind('all');setQuery('')}
  return ok;
 }

 const upcomingCount=bookings.filter(b=>bookingStatus(b,now)!=='completed').length;
 const wide=['book','create','edit','poll'].includes(modal);
 return <div className="shell">
  <Sidebar view={view} onView={setView} upcomingCount={upcomingCount} user={user} onLogin={()=>setModal('login')}/>
  <div className="mainwrap">
   <AppHeader view={view} setup={setup} user={user} onLogin={()=>setModal('login')}/>
   <main>
    {calendarSync&&<div className="notice" role="status">{calendarSync.ok?`Google 캘린더 동기화 · ${new Date(calendarSync.checkedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} (한국시간)`:<>Google 캘린더를 확인하지 못해 신규 예약을 잠시 중지했습니다. <a href="/auth/google">Google 다시 연결</a></>}</div>}
    <div className="heading"><div><div className="eyebrow">MAKE TIME FOR WHAT MATTERS</div><h1>{view}</h1><p>{subtitle(view)}</p></div>{view==='예약 페이지'&&<button className="primary" onClick={createMeeting}><Plus size={18}/>예약 페이지 만들기</button>}</div>
    {view==='예약 페이지'&&<PagesView ws={ws} query={query} onQuery={setQuery} kind={kind} onKind={setKind} onCreate={createMeeting} onAvailability={()=>setView('가능 시간')}
     onToggleActive={e=>save({events:events.map(x=>x.id===e.id?{...x,active:!x.active}:x)})}
     onEdit={e=>openModal('edit',e)} onDelete={e=>openModal('delete',e)} onInvite={e=>openModal('invite',e)} onPreview={e=>openModal('book',e)} onPoll={(p:Poll)=>openModal('poll',p)}/>}
    {view==='가능 시간'&&<HoursView ws={ws} onSave={()=>save({hours:ws.hours,range:ws.range})}/>}
    {view==='예약된 일정'&&<BookingsCalendar bookings={bookings} now={now} busy={busy} onCancel={id=>save({bookings:bookings.filter(b=>b.id!==id)})}/>}
    {view==='설정 및 연동'&&<SettingsView user={user}/>}
   </main>
   <footer><span>© 2026 모아타임</span><span>시간을 모아, 더 좋은 만남으로.</span><span><Globe size={13}/>한국어 · KST</span></footer>
  </div>
  {modal&&<div className="overlay" onClick={()=>{if(!busy)close()}}><section role="dialog" aria-modal="true" aria-label="예약 및 로그인" className={'modal '+(wide?'wide':'')} onClick={e=>e.stopPropagation()}>
   <button className="close" disabled={busy} aria-label="닫기" onClick={close}><X/></button>
   {modal==='create'&&<div className="creation-kind"><span className="eyebrow">일정 유형</span><div role="group" aria-label="일정 유형"><button type="button" disabled={busy} aria-pressed={creationKind==='booking'} onClick={()=>{setCreationKind('booking');setCreateError('')}}><strong>1:1 예약</strong><small>한 사람이 시간을 선택하면 예약 확정</small></button><button type="button" disabled={busy} aria-pressed={creationKind==='poll'} onClick={()=>{setCreationKind('poll');setCreateError('')}}><strong>여러 명 일정 투표</strong><small>여러 사람의 가능 시간을 모아 주최자가 확정</small></button></div></div>}
   {(modal==='create'||modal==='edit')&&<><EventEditor key={modal==='edit'?item.id:'new'} initial={modal==='edit'?item:undefined} purpose={modal==='create'?creationKind:'booking'} extraFields={modal==='create'&&creationKind==='poll'?<label>예상 참석 인원 (주최자 제외)<input required type="number" min={1} max={100} value={expected||''} onChange={e=>setExpected(Number(e.target.value))}/><small>주최자는 후보 시간에 참석 가능한 것으로 처리합니다.</small></label>:undefined} team={false} hours={ws.hours} range={ws.range} busy={busy} onSave={saveEvent}/>{createError&&modal==='create'&&<p role="alert" className="notice creation-error">{createError}</p>}</>}
   {modal==='poll'&&<PollDetails key={item.id} id={item.id} hours={ws.hours} range={ws.range} onBusyChange={ws.setBusy} onChanged={poll=>ws.setPolls(prev=>prev.map(p=>p.id===poll.id?poll:p))}/>}
   {modal==='invite'&&<InviteLinkModal event={item} onCopy={async company=>{if(await ws.copyLink(item,company))close()}}/>}
   {modal==='delete'&&<DeletePageModal event={item} bookingCount={bookings.filter(b=>b.eventId===item.id).length} busy={busy} onCancel={close} onDelete={async()=>{if(await save({deleteEventId:item.id})){close();ws.notify('예약 페이지를 삭제했습니다.')}}}/>}
   {modal==='login'&&<LoginModal setup={setup}/>}
   {modal==='book'&&<BookPreview key={item.id} event={item} mode={mode} busy={busy} onBook={async b=>{if(await save({bookings:[...bookings,{id:crypto.randomUUID(),eventId:item.id,title:item.title,duration:item.duration,...b,channels:['email'],notificationConsent:true}]})){setBooked({day:b.day,time:b.time});setModal('success')}}}/>}
   {modal==='success'&&<BookedModal title={item.title} day={booked.day} time={booked.time} mode={mode} onDone={()=>{close();setView('예약된 일정')}}/>}
  </section></div>}
  {ws.toast&&<div className="toast" role="status"><Check size={17}/>{ws.toast}</div>}
 </div>;
}
