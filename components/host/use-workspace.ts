"use client";
import {useState,useEffect,useRef} from 'react';
import type {Poll} from '@/lib/polls/model';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HostEvent=any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HostBooking=any;
export type HostUser={name?:string;email?:string}|null;
export const seed:HostEvent[]=[{id:'coffee',title:'가볍게 나누는 커피챗',desc:'새로운 연결의 시작, 편하게 이야기 나눠요.',duration:30,color:'blue',team:false,active:true},{id:'project',title:'프로젝트 상담',desc:'아이디어를 함께 구체화하는 시간입니다.',duration:60,color:'purple',team:false,active:true},{id:'sync',title:'빠른 싱크업',desc:'짧고 집중해서, 필요한 이야기만 나눠요.',duration:15,color:'orange',team:false,active:true},{id:'team',title:'서비스 데모 미팅',desc:'서비스를 함께 살펴보는 시간입니다.',duration:30,color:'green',team:false,active:true}];

// Host workspace state: initial load, background refresh, saves with revision, public links and polls.
// `paused` (a modal is open) stops background refreshes so they never overwrite an edit in progress.
export function useWorkspace({view,paused}:{view:string;paused:boolean}){
 const [events,setEvents]=useState<HostEvent[]>(seed),[bookings,setBookings]=useState<HostBooking[]>([]);
 const [hours,setHours]=useState([false,true,true,true,true,true,false]),[range,setRange]=useState(['09:00','18:00']);
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 const [user,setUser]=useState<HostUser>(null),[setup,setSetup]=useState(false),[mode,setMode]=useState('off');
 const [calendarSync,setCalendarSync]=useState<{checkedAt:string;ok:boolean}|null>(null);
 const [polls,setPolls]=useState<Poll[]>([]),[pollError,setPollError]=useState(''),[pollLoading,setPollLoading]=useState(false),[pollReload,setPollReload]=useState(0);
 const [toast,setToast]=useState('');
 const clockOffset=useRef(0);
 const [now,setNow]=useState(()=>Date.now());
 const notify=(s:string)=>{setToast(s);setTimeout(()=>setToast(''),4000)};

 useEffect(()=>{const update=()=>setNow(Date.now()+clockOffset.current);const timer=setInterval(update,15000);window.addEventListener('focus',update);return ()=>{clearInterval(timer);window.removeEventListener('focus',update)}},[]);
 useEffect(()=>{fetch('/api/workspace').then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>{if(!d.user&&!d.setupRequired){location.replace('/');return}if(Number.isFinite(d.serverNow)){clockOffset.current=d.serverNow-Date.now();setNow(d.serverNow)}if(d.calendarSync)setCalendarSync(d.calendarSync);if(d.events)setEvents(d.events);if(d.bookings)setBookings(d.bookings);if(d.hours)setHours(d.hours);if(d.range)setRange(d.range);setRevision(d.revision||0);setUser(d.user);setSetup(!!d.setupRequired);setMode(d.notifications?.mode||'off');setReady(true)}).catch(()=>notify('저장소를 불러오지 못했습니다. 다시 시도해 주세요.'))},[]);
 useEffect(()=>{const q=new URLSearchParams(location.search);if(q.has('auth_error'))notify(q.get('auth_error')==='calendar'?'로그인되었습니다. 캘린더 연결 설정을 확인하고 다시 연결해 주세요.':'Google 로그인 설정을 확인하고 다시 시도해 주세요.')},[]);
 useEffect(()=>{if(busy||paused||!ready)return;let active=true;const refresh=async()=>{try{const r=await fetch('/api/workspace',{cache:'no-store'});if(!r.ok)return;const d=await r.json();if(!active)return;if(!d.user&&!d.setupRequired){location.replace('/');return}if(d.bookings)setBookings(d.bookings);if(d.calendarSync)setCalendarSync(d.calendarSync);if(d.events)setEvents(d.events);setRevision(d.revision||0)}catch{}};void refresh();const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',refresh)}},[view,busy,paused,ready]);
 useEffect(()=>{
  if(!ready||!user||paused)return;
  let active=true;
  const load=async()=>{setPollLoading(true);try{const r=await fetch('/api/polls',{cache:'no-store',signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok)throw Error(d.error);if(active){setPolls(d.polls);setPollError('')}}catch(e){if(active)setPollError(e instanceof Error?e.message:'여러 명 일정을 불러오지 못했습니다.')}finally{if(active)setPollLoading(false)}};
  void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load()},30000);
  return()=>{active=false;clearInterval(timer)};
 },[ready,user?.email,paused,pollReload]); // eslint-disable-line react-hooks/exhaustive-deps

 // Returns false when the save did not happen; `onLoginRequired` opens the login prompt.
 async function save(data:Record<string,unknown>,onLoginRequired:()=>void){if(!user){onLoginRequired();notify(setup?'Supabase 연결 설정이 필요합니다.':'Google 로그인 후 저장할 수 있습니다.');return false}setBusy(true);try{const r=await fetch('/api/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,revision})});const result=await r.json();if(!r.ok)throw Error(result.error);setRevision(result.revision);if(result.notificationMode)setMode(result.notificationMode);if(result.events)setEvents(result.events);else if(data.events)setEvents(data.events as HostEvent[]);if(result.calendarSync)setCalendarSync(result.calendarSync);if(result.bookings)setBookings(result.bookings);else if(data.bookings)setBookings(data.bookings as HostBooking[]);notify(result.calendarPending?'예약은 저장했습니다. 설정 및 연동에서 캘린더 반영을 재시도해 주세요.':'저장했습니다');return true}catch(e){notify(e instanceof Error?e.message:'저장하지 못했습니다.');return false}finally{setBusy(false)}}
 async function copyLink(e:HostEvent,company=''){try{const r=await fetch('/api/public-links',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventId:e.id})});const data=await r.json();if(!r.ok)throw Error(data.error);await navigator.clipboard.writeText(location.origin+data.path+(company.trim()?'#company='+encodeURIComponent(company.trim()):''));notify('공개 예약 링크를 복사했습니다');return true}catch(error){notify(error instanceof Error?error.message:'링크를 복사하지 못했습니다.');return false}}

 return {events,bookings,hours,setHours,range,setRange,ready,busy,setBusy,user,setup,mode,calendarSync,now,polls,setPolls,pollError,pollLoading,reloadPolls:()=>setPollReload(v=>v+1),toast,notify,save,copyLink};
}
export type Workspace=ReturnType<typeof useWorkspace>;
