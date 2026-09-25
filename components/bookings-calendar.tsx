'use client';
import {useState} from 'react';
import {ChevronLeft,ChevronRight,CalendarDays,List} from 'lucide-react';
import type {Booking} from '@/lib/workspace';
import {bookingStart,bookingStatus,seoulDay} from '@/lib/bookings/status';

export default function BookingsCalendar({bookings,now,busy,onCancel}:{bookings:Booking[];now:number;busy:boolean;onCancel:(id:string)=>Promise<unknown>}){
 const today=seoulDay(now);
 const [month,setMonth]=useState(today.slice(0,7)),[selected,setSelected]=useState(today),[filter,setFilter]=useState<'upcoming'|'completed'>('upcoming'),[layout,setLayout]=useState<'calendar'|'list'>('calendar');
 const upcoming=bookings.filter(b=>bookingStatus(b,now)!=='completed');
 const completed=bookings.filter(b=>bookingStatus(b,now)==='completed');
 const filtered=(filter==='upcoming'?upcoming:completed).slice().sort((a,b)=>filter==='upcoming'?bookingStart(a)-bookingStart(b):bookingStart(b)-bookingStart(a));
 const shown=layout==='calendar'?filtered.filter(b=>b.day===selected):filtered;
 const [year,monthNumber]=month.split('-').map(Number);
 const offset=new Date(Date.UTC(year,monthNumber-1,1)).getUTCDay();
 const days=new Date(Date.UTC(year,monthNumber,0)).getUTCDate();
 function move(delta:number){const d=new Date(Date.UTC(year,monthNumber-1+delta,1));const next=d.toISOString().slice(0,7);setMonth(next);setSelected(next+'-01')}
 return <section className="panel booking-agenda"><div className="agenda-toolbar"><div className="tabs" role="tablist" aria-label="일정 상태"><button role="tab" aria-selected={filter==='upcoming'} className={filter==='upcoming'?'chosen':''} onClick={()=>setFilter('upcoming')}>예정·진행 중 <span>{upcoming.length}</span></button><button role="tab" aria-selected={filter==='completed'} className={filter==='completed'?'chosen':''} onClick={()=>setFilter('completed')}>완료 <span>{completed.length}</span></button></div><div className="agenda-view"><button aria-pressed={layout==='calendar'} onClick={()=>setLayout('calendar')}><CalendarDays size={16}/>캘린더</button><button aria-pressed={layout==='list'} onClick={()=>setLayout('list')}><List size={16}/>목록</button></div></div><p className="agenda-help">한국시간 기준 · 종료 시간이 지난 일정은 자동으로 완료로 표시됩니다.</p>
 {layout==='calendar'&&<><div className="month"><button aria-label="이전 달" onClick={()=>move(-1)}><ChevronLeft/></button><h2>{year}년 {monthNumber}월</h2><button onClick={()=>{setMonth(today.slice(0,7));setSelected(today)}}>오늘</button><button aria-label="다음 달" onClick={()=>move(1)}><ChevronRight/></button></div><div className="agenda-grid">{['일','월','화','수','목','금','토'].map(d=><small key={d}>{d}</small>)}{Array.from({length:offset},(_,i)=><span key={'blank'+i}/>)}{Array.from({length:days},(_,i)=>{const day=`${month}-${String(i+1).padStart(2,'0')}`,items=filtered.filter(b=>b.day===day);return <button key={day} className={selected===day?'selected':''} aria-pressed={selected===day} aria-current={today===day?'date':undefined} aria-label={`${day}, ${items.length}개 일정`} onClick={()=>setSelected(day)}><b>{i+1}{day===today&&<small>오늘</small>}</b><span className="agenda-count">{items.length?`${items.length}개 일정`:''}</span>{items.slice(0,2).map(b=><span className="agenda-event" key={b.id}>{b.time} {b.title}</span>)}{items.length>2&&<small>+{items.length-2}개</small>}</button>})}</div><h3 className="agenda-date">{selected} · {shown.length}개 일정</h3></>}
 {!shown.length?<div className="empty"><CalendarDays size={32}/><h3>{layout==='calendar'?'선택한 날짜에 일정이 없어요':filter==='completed'?'아직 완료된 일정이 없어요':'예정된 일정이 없어요'}</h3><p>{layout==='calendar'?'다른 날짜를 선택하거나 목록 보기에서 전체 일정을 확인하세요.':'예약한 일정이 여기에 표시됩니다.'}</p></div>:shown.map(b=>{const status=bookingStatus(b,now);return <div className="bookingrow" key={b.id}><div><span className={'agenda-status '+status}>{status==='completed'?'완료':status==='ongoing'?'진행 중':'예정'}</span><h3>{b.title}</h3><p>{b.day} · {b.time} · {b.duration}분 · {b.name}</p><small>{b.email}</small></div>{status==='upcoming'&&<button disabled={busy} onClick={()=>{if(window.confirm(`${b.title} (${b.day} ${b.time}) 예약을 취소할까요?`))void onCancel(b.id)}}>예약 취소</button>}</div>})}</section>;
}
