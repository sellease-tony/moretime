import type {Metadata} from 'next';
import {redirect} from 'next/navigation';
import {cookies} from 'next/headers';
import {CalendarDays,ArrowLeft} from 'lucide-react';
import SignupConsent from '@/components/signup-consent';
import {oauthUser} from '@/lib/supabase/server';
import {isHost} from '@/lib/auth/role';
import {hasConsent} from '@/lib/auth/consent';
import {PENDING_COOKIE,decodePending} from '@/lib/auth/pending-signup';
import s from '../landing.module.css';
export const metadata:Metadata={title:'회원가입 · 모아타임',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';

// Shown right after a first-time Google/Microsoft sign-in (or after a material terms change).
export default async function Signup({searchParams}:{searchParams:Promise<{error?:string}>}){
 const {error}=await searchParams;
 const user=await oauthUser();
 if(!user)redirect('/login');
 if(isHost(user.app_metadata)&&hasConsent(user.app_metadata))redirect('/app');
 if(!decodePending((await cookies()).get(PENDING_COOKIE)?.value,user.id))redirect('/login?auth_error=signup_expired');
 const provider=user.app_metadata?.provider==='azure'?'Microsoft':'Google';
 return <div className={s.loginPage}><a className={s.back} href="/"><ArrowLeft size={16}/>모아타임 홈으로</a><main className={s.loginCard}><span className={s.mark}><CalendarDays size={28}/></span><p className={s.eyebrow}>ALMOST DONE</p><h1>가입을 마무리할게요</h1><p><b>{user.email}</b><br/>{provider} 계정으로 모아타임에 가입합니다.<br/>아래 약관에 동의하면 바로 시작할 수 있어요.</p>{error==='consent'&&<p className={s.error} role="alert">필수 항목에 모두 동의해 주세요.</p>}<SignupConsent buttonClass={s.googleButton}/><p className={s.loginLegal}>동의하지 않으려면 이 화면을 닫으면 됩니다. 가입이 완료되지 않으며 캘린더 정보도 저장되지 않습니다.</p></main></div>;
}
