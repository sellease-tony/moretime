"use client";
import {useState} from 'react';
import {ArrowRight} from 'lucide-react';
import {CONSENT_VERSION} from '@/lib/auth/consent';

// Required agreements shown once, after a first-time sign-in (and again only when the terms change materially).
// /auth/complete-signup checks the same fields on the server before the account becomes a host.
export default function SignupConsent({buttonClass}:{buttonClass:string}){
 const [terms,setTerms]=useState(false),[privacy,setPrivacy]=useState(false),[sending,setSending]=useState(false);
 const all=terms&&privacy;
 return <form className="signup-consent" method="post" action="/auth/complete-signup" onSubmit={e=>{if(!all||sending)e.preventDefault();else setSending(true)}}>
  <input type="hidden" name="consent" value={CONSENT_VERSION}/>
  <fieldset>
   <legend className="sr-only">서비스 이용 동의</legend>
   <label className="consent-all"><input type="checkbox" checked={all} onChange={e=>{setTerms(e.target.checked);setPrivacy(e.target.checked)}}/><strong>전체 동의</strong></label>
   <label><input type="checkbox" name="terms" checked={terms} onChange={e=>setTerms(e.target.checked)}/><span><em>[필수]</em> 이용약관 동의</span><a href="/terms" target="_blank" rel="noopener">보기</a></label>
   <label><input type="checkbox" name="privacy" checked={privacy} onChange={e=>setPrivacy(e.target.checked)}/><span><em>[필수]</em> 개인정보 수집·이용 동의</span><a href="/privacy" target="_blank" rel="noopener">보기</a></label>
   <details><summary>수집 항목과 보유 기간</summary><dl>
    <dt>수집 항목</dt><dd>Google 또는 Microsoft 계정 이름·이메일·프로필 식별자, Google 또는 Outlook 캘린더 접근 권한(암호화 저장), 캘린더의 바쁜 시간 구간</dd>
    <dt>이용 목적</dt><dd>회원 식별, 예약 가능 시간 계산, 확정된 예약의 캘린더 등록과 알림 발송</dd>
    <dt>보유 기간</dt><dd>회원 탈퇴 시까지</dd>
    <dt>처리 위탁</dt><dd>Google·Microsoft(로그인, 캘린더 연동), Supabase·Vercel·Resend(서비스 운영, 국외 이전 포함). 자세한 내용은 개인정보 처리방침에서 확인할 수 있습니다.</dd>
   </dl><p>동의를 거부할 수 있으나, 거부하면 서비스에 가입할 수 없습니다.</p></details>
  </fieldset>
  <button className={buttonClass} style={{width:'100%'}} disabled={!all||sending} aria-disabled={!all}>{sending?'가입 처리 중…':'동의하고 가입 완료'}<ArrowRight size={17}/></button>
  {!all&&<small className="consent-hint">필수 항목에 동의하면 가입이 완료됩니다.</small>}
 </form>;
}
