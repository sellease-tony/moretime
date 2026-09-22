import type {Metadata} from 'next';
import {redirect} from 'next/navigation';
import {CalendarDays,ArrowLeft,ArrowRight,ShieldCheck} from 'lucide-react';
import {currentUser,supabaseConfigured} from '@/lib/supabase/server';
import s from '../landing.module.css';
export const metadata:Metadata={title:'로그인 및 회원가입 · 모아타임',robots:{index:false,follow:false}};
export default async function Login({searchParams}:{searchParams:Promise<{auth_error?:string}>}){
 const {auth_error}=await searchParams;
 if(await currentUser()&&!auth_error)redirect('/app');
 const configured=supabaseConfigured();
 return <div className={s.loginPage}><a className={s.back} href="/"><ArrowLeft size={16}/>모아타임 홈으로</a><main className={s.loginCard}><span className={s.mark}><CalendarDays size={28}/></span><p className={s.eyebrow}>WELCOME TO MOATIME</p><h1>좋은 만남의 시작,<br/>모아타임과 함께.</h1><p>Google 계정 하나로 로그인하고<br/>나만의 예약 페이지를 만들어보세요.</p>{auth_error&&<p className={s.error} role="alert">{auth_error==='calendar'?'캘린더 연결을 완료하지 못했습니다. 다시 연결해 주세요.':'Google 로그인을 완료하지 못했습니다. 서비스의 Google 연결 설정이 아직 준비 중이거나 인증이 취소되었습니다.'}</p>}{configured?<a className={s.googleButton} href="/auth/google"><span aria-hidden="true">G</span>Google로 시작하기<ArrowRight size={17}/></a>:<p className={s.error} role="status">Google 로그인 연결을 준비하고 있습니다. 설정이 완료되면 이곳에서 시작할 수 있습니다.</p>}<small>처음 방문하셨나요? Google 인증 시 회원가입이 함께 진행됩니다.</small><div className={s.loginNote}><ShieldCheck size={18}/><span>예약 가능한 시간을 확인하기 위해<br/>주최자의 Google 캘린더 조회·일정 등록 권한을 요청합니다.</span></div></main></div>;
}
