"use client";
import {useState} from 'react';
import {Check,ArrowRight,Sparkles} from 'lucide-react';
import {plans,won,yearlyTotal,PRO_TRIAL_DAYS} from '@/lib/plans';
import s from '@/app/landing.module.css';

// Landing pricing cards. Paid checkout is not open yet, so both CTAs lead to sign-up (everyone gets Pro during beta).
export default function PricingTable(){
 const [yearly,setYearly]=useState(true);
 return <>
  <div className={s.billingToggle} role="group" aria-label="결제 주기">
   <button type="button" aria-pressed={!yearly} onClick={()=>setYearly(false)}>월간 결제</button>
   <button type="button" aria-pressed={yearly} onClick={()=>setYearly(true)}>연간 결제 <em>20% 할인</em></button>
  </div>
  <div className={s.planGrid}>{plans.map(p=>{const pro=p.id==='pro',price=yearly?p.yearlyPerMonth:p.monthly;return <article key={p.id} className={pro?s.planPro:s.plan}>
   {pro&&<span className={s.planBadge}><Sparkles size={13}/>가장 많이 선택</span>}
   <h3>{p.name}</h3><p className={s.planTagline}>{p.tagline}</p>
   <div className={s.planPrice}><strong>{price?won(price):'0원'}</strong>{price>0&&<span>/ 월</span>}</div>
   <small className={s.planNote}>{!price?'평생 무료 · 카드 등록 없음':yearly?`연 ${won(yearlyTotal(p))} 일괄 결제 · 부가세 포함`:'매월 결제 · 부가세 포함'}</small>
   <a className={pro?s.cta:s.planButton} href="/login">{pro?`${PRO_TRIAL_DAYS}일 무료로 써보기`:'무료로 시작하기'}<ArrowRight size={17}/></a>
   <ul>{p.features.map(f=><li key={f}><Check size={16}/>{f}</li>)}</ul>
  </article>})}</div>
  <p className={s.betaNote}><Sparkles size={15}/>지금은 베타 기간이라 <b>모든 기능을 무료로</b> 쓸 수 있어요. 유료 결제가 열리면 미리 메일로 안내드립니다.</p>
 </>;
}
