"use client";
import {GoogleLogo,MicrosoftLogo} from '@/components/brand-logos';
import {useState} from 'react';
import {ArrowRight} from 'lucide-react';
import {CONSENT_VERSION} from '@/lib/auth/consent';

// Required agreements before the host's Google sign-up. The Google button stays disabled until both are checked,
// and /auth/google refuses a host sign-in that arrives without this consent.
export default function SignupConsent({buttonClass,label='Google로 시작하기'}:{buttonClass:string;label?:string}){
 const [terms,setTerms]=useState(false),[privacy,setPrivacy]=useState(false);
 const all=terms&&privacy;
 return <div className="signup-consent">
  <fieldset>
   <legend className="sr-only">서비스 이용 동의</legend>
   <label className="consent-all"><input type="checkbox" checked={all} onChange={e=>{setTerms(e.target.checked);setPrivacy(e.target.checked)}}/><strong>전체 동의</strong></label>
   <label><input type="checkbox" checked={terms} onChange={e=>setTerms(e.target.checked)}/><span><em>[필수]</em> 이용약관 동의</span><a href="/terms" target="_blank" rel="noopener">보기</a></label>
   <label><input type="checkbox" checked={privacy} onChange={e=>setPrivacy(e.target.checked)}/><span><em>[필수]</em> 개인정보 수집·이용 동의</span><a href="/privacy" target="_blank" rel="noopener">보기</a></label>
   <details><summary>수집 항목과 보유 기간</summary><dl>
    <dt>수집 항목</dt><dd>Google 계정 이름·이메일·프로필 식별자, 캘린더 접근 권한(암호화 저장), 캘린더의 바쁜 시간 구간</dd>
    <dt>이용 목적</dt><dd>회원 식별, 예약 가능 시간 계산, 확정된 예약의 캘린더 등록과 알림 발송</dd>
    <dt>보유 기간</dt><dd>회원 탈퇴 시까지</dd>
   </dl><p>동의를 거부할 수 있으나, 거부하면 서비스에 가입할 수 없습니다.</p></details>
  </fieldset>
  <a className={buttonClass} href={all?'/auth/google?consent='+CONSENT_VERSION:undefined} aria-disabled={!all} onClick={e=>{if(!all)e.preventDefault()}}><GoogleLogo/>{label}<ArrowRight size={17}/></a>
  <a className={buttonClass+' microsoft-button'} style={{marginTop:10}} href={all?'/auth/microsoft?consent='+CONSENT_VERSION:undefined} aria-disabled={!all} onClick={e=>{if(!all)e.preventDefault()}}><MicrosoftLogo/>{label.replace('Google','Microsoft')}<ArrowRight size={17}/></a>
  <small className="provider-hint" style={{display:'block',textAlign:'center',fontSize:12,lineHeight:1.6,marginTop:10,color:'var(--text-secondary)'}}>Google 캘린더 또는 Outlook(Microsoft 365) 캘린더 중 쓰시는 쪽으로 시작하세요.</small>
  {!all&&<small className="consent-hint">필수 항목에 동의하면 시작할 수 있습니다.</small>}
 </div>;
}
