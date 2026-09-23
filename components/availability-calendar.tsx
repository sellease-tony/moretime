"use client";
import {addDays,kstDay} from '@/lib/availability';
export default function AvailabilityCalendar({month,onMonth,day,onDay,days,editing=false,loading=false}:{month:string;onMonth:(v:string)=>void;day:string;onDay:(v:string)=>void;days:Record<string,string[]>;editing?:boolean;loading?:boolean}){
  const today=kstDay(),max=addDays(today,90),[year,m]=month.split('-').map(Number);
  const shift=(n:number)=>new Date(Date.UTC(year,m-1+n,1)).toISOString().slice(0,7);
  return <div className="availability-calendar" aria-busy={loading}><div className="month"><button type="button" aria-label="이전 달" disabled={month<=today.slice(0,7)||loading} onClick={()=>onMonth(shift(-1))}>‹</button><strong>{year}년 {m}월</strong><button type="button" aria-label="다음 달" disabled={month>=max.slice(0,7)||loading} onClick={()=>onMonth(shift(1))}>›</button></div><div className="calendar">{['일','월','화','수','목','금','토'].map(d=><small key={d}>{d}</small>)}{Array.from({length:new Date(Date.UTC(year,m-1,1)).getUTCDay()},(_,i)=><span key={'blank'+i}/>)}{Array.from({length:new Date(Date.UTC(year,m,0)).getUTCDate()},(_,i)=>{
    const date=`${month}-${String(i+1).padStart(2,'0')}`,count=days[date]?.length||0;
    return <button type="button" key={date} disabled={loading||date<today||date>max||(!editing&&!count)} aria-label={`${date}, ${count}개 시간${day===date?', 선택됨':''}`} aria-pressed={day===date} className={(day===date?'picked ':'')+(count?'has-slots':'')} onClick={()=>onDay(date)}>{i+1}{count>0&&<i/>}</button>;
  })}</div><p className="calendar-legend"><i/> {editing?'시간을 선택한 날짜':'예약 가능한 날짜'} · 한국시간</p></div>;
}
