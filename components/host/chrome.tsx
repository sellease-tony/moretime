"use client";
import {CalendarDays,Link2,Clock3,Settings,ChevronRight,ArrowUpRight} from 'lucide-react';
import type {HostUser} from './use-workspace';
export const VIEWS=['예약 페이지','예약된 일정','가능 시간','설정 및 연동'] as const;
export type View=typeof VIEWS[number];
const ICONS={'예약 페이지':Link2,'예약된 일정':CalendarDays,'가능 시간':Clock3,'설정 및 연동':Settings};
const SUBTITLES:Record<View,string>={'예약 페이지':'링크 하나로, 서로에게 딱 맞는 시간을 만나세요.','예약된 일정':'다가오는 만남을 한눈에 확인하세요.','가능 시간':'미팅에 집중할 시간을 정해두세요.','설정 및 연동':'Google 계정과 캘린더 연결을 관리하세요.'};
export const subtitle=(view:View)=>SUBTITLES[view];

export function Sidebar({view,onView,upcomingCount,user,onLogin}:{view:View;onView:(v:View)=>void;upcomingCount:number;user:HostUser;onLogin:()=>void}){
 return <aside><a className="brand" href="/app"><span className="logo"><CalendarDays size={22}/></span>모아타임<span className="dot">.</span></a><div className="workspace"><span className="avatar">나</span><span><strong>내 워크스페이스</strong><small>개인 워크스페이스</small></span></div><span className="navlabel">WORKSPACE</span><nav>{VIEWS.map(title=>{const Icon=ICONS[title];return <button key={title} className={view===title?'active':''} onClick={()=>onView(title)}><Icon size={19}/>{title}{title==='예약된 일정'&&upcomingCount>0&&<em>{upcomingCount}</em>}</button>})}</nav><div className="sidebottom"><button className="settings" onClick={()=>onView('설정 및 연동')}><Settings size={18}/>설정 및 연동</button><button className="profile" onClick={()=>user?onView('설정 및 연동'):onLogin()}><span className="avatar neutral">나</span><span><strong>{user?.name||'Google 로그인 필요'}</strong><small>{user?.email||'Google로 로그인하기'}</small></span><ChevronRight size={16}/></button></div></aside>;
}

export function AppHeader({view,setup,user,onLogin}:{view:View;setup:boolean;user:HostUser;onLogin:()=>void}){
 return <header><span>워크스페이스 <ChevronRight size={13}/><b>{view}</b></span><div><span className="pill">{setup?'연결 설정 필요':user?'Supabase 연결':'미리보기'}</span>{user?<button onClick={async()=>{await fetch('/auth/logout',{method:'POST'});location.assign('/')}}>로그아웃</button>:<button onClick={onLogin}>로그인 <ArrowUpRight size={15}/></button>}</div></header>;
}
