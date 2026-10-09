"use client";
import {useState} from 'react';
import {CalendarDays,Check} from 'lucide-react';
import type {HostEvent} from './use-workspace';

export function InviteLinkModal({event,onCopy}:{event:HostEvent;onCopy:(company:string)=>void}){
 const [company,setCompany]=useState('');
 return <form onSubmit={e=>{e.preventDefault();onCopy(company)}}><h2>고객사 지정 링크</h2><p>{event.title}</p><label>회사명<input required maxLength={80} value={company} onChange={e=>setCompany(e.target.value)} placeholder="ABC파트너스"/></label><p>예약 화면에 회사명이 미리 입력됩니다. 게스트가 수정할 수 있습니다.</p><button className="primary full">링크 복사</button></form>;
}

export function DeletePageModal({event,bookingCount,busy,onCancel,onDelete}:{event:HostEvent;bookingCount:number;busy:boolean;onCancel:()=>void;onDelete:()=>void}){
 return <div className="delete-confirm"><h2>예약 페이지를 삭제할까요?</h2><p><strong>{event.title}</strong></p><p>목록에서 삭제되고, 공유한 링크로 새 예약을 받을 수 없습니다. 삭제는 되돌릴 수 없습니다.</p><div className="notice">이미 확정된 예약 {bookingCount}건과 Google 캘린더 일정은 유지됩니다. 기존 예약자는 전용 링크에서 취소할 수 있지만 날짜 변경은 할 수 없습니다.</div><div className="delete-actions"><button disabled={busy} onClick={onCancel}>돌아가기</button><button className="danger-button" disabled={busy} onClick={onDelete}>{busy?'삭제 중…':'예약 페이지 삭제'}</button></div></div>;
}

export function LoginModal({setup}:{setup:boolean}){
 return <div className="auth"><span className="logo"><CalendarDays/></span><h2>반가워요, 모아타임입니다</h2><p>Google 계정으로 로그인하고 캘린더를 연결하세요.</p><a className="authbutton" href="/auth/google"><span className="google">G</span>Google로 계속하기</a><p>Google 계정 하나로 바로 시작하세요.</p><div className="notice">{setup?'Supabase 및 Google OAuth 연결값 설정이 필요합니다.':'캘린더의 바쁜 시간만 예약 가능 시간 계산에 사용합니다. 일정 제목과 내용을 예약자에게 공개하지 않습니다.'}</div></div>;
}

export function BookedModal({title,day,time,mode,onDone}:{title:string;day:string;time:string;mode:string;onDone:()=>void}){
 return <div className="auth"><span className="successicon"><Check/></span><h2>예약이 저장되었습니다</h2><p>{title}</p><h3>{day} · {time}</h3><p>{mode==='live'?'예약 알림을 발송 대기열에 등록했습니다. 접수 결과는 설정에서 확인하세요.':'예약은 저장되었으며, 현재 알림 모드에서는 실제 메시지를 발송하지 않습니다.'}</p><button className="primary full" onClick={onDone}>예약된 일정 확인하기</button></div>;
}
