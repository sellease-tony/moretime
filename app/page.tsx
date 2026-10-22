import type { Metadata } from 'next';
import BusinessInfo from '@/components/business-info';
import {CalendarDays,ArrowUpRight,ArrowRight,Check,Clock3,Link2,ShieldCheck,Video,ChevronRight,Users,CalendarCheck,BellRing,RefreshCw,SlidersHorizontal,Car,Building2,MailCheck} from 'lucide-react';
import PricingTable from '@/components/pricing-table';
import {plans} from '@/lib/plans';
import {siteUrl} from '@/lib/site';
import s from './landing.module.css';
export const metadata:Metadata={
 title:'모아타임 · 일정 조율은 짧게, 좋은 만남은 길게',
 description:'Google 캘린더와 연결하는 일정 예약 서비스 모아타임. 예약 페이지를 만들고 링크를 공유해 커피챗, 상담, 미팅 시간을 간편하게 조율하세요.',
 alternates:{canonical:siteUrl},
 openGraph:{type:'website',locale:'ko_KR',url:siteUrl,siteName:'모아타임',title:'일정 조율은 짧게, 좋은 만남은 길게 · 모아타임',description:'가능한 시간을 모아, 예약 링크 하나로. 1:1 예약부터 여러 명 일정 투표까지, Google 캘린더 기반 일정 예약.'},
 twitter:{card:'summary_large_image',title:'모아타임 · 좋은 만남을 위한 시간',description:'가능한 시간을 모아, 예약 링크 하나로.'},
 robots:{index:true,follow:true}
};
const faqs=[
 ['모아타임은 어떤 서비스인가요?','미팅 가능한 시간을 정해 두고 예약 링크를 공유하면, 상대방이 편한 시간을 골라 바로 예약하는 일정 예약 서비스입니다. 커피챗, 상담, 서비스 데모, 여러 명이 모이는 회의 시간 조율까지 쓸 수 있습니다.'],
 ['예약하는 사람도 가입해야 하나요?','아니요. 예약자는 로그인 없이 이름과 이메일만 입력하면 예약할 수 있습니다. 가입은 예약 페이지를 만드는 주최자만 Google 계정으로 합니다.'],
 ['Google 캘린더의 기존 일정과 겹치지 않나요?','내 Google 캘린더의 바쁜 시간은 예약 가능 시간에서 자동으로 빠집니다. 일정 제목이나 내용은 예약자에게 보이지 않습니다. 예약이 확정되면 내 캘린더에 일정이 등록되고, 온라인 미팅이면 Google Meet 링크도 함께 만들어집니다.'],
 ['예약 알림은 어떻게 받나요?','예약이 확정·변경·취소되면 예약자와 주최자 모두에게 이메일을 보냅니다. 프로 플랜은 미팅 하루 전과 1시간 전 리마인더도 보내 노쇼를 줄여 줍니다. 문자·카카오 알림톡은 아직 제공하지 않습니다.'],
 ['무료 플랜으로도 충분한가요?','예약 페이지 1개로 커피챗이나 상담 하나를 운영한다면 무료로 충분합니다. 예약 횟수에는 제한이 없습니다. 미팅 종류가 여러 개이거나 리마인더·예약 규칙이 필요하면 프로를 추천합니다.'],
 ['결제와 해지는 어떻게 하나요?','프로는 월 5,000원(연간 결제 시 월 4,000원, 부가세 포함)입니다. 14일 무료 체험은 카드 등록 없이 시작하고, 체험이 끝나도 자동 결제되지 않습니다. 구독은 언제든 해지할 수 있고, 결제한 기간이 끝날 때까지 프로를 계속 쓸 수 있습니다. 지금은 베타 기간이라 모든 기능이 무료입니다.'],
];
const allFeatures=[
 [Video,'Google Meet 자동 생성','온라인 미팅은 예약과 동시에 Meet 링크가 만들어져요.'],
 [CalendarCheck,'캘린더 자동 등록','확정된 예약이 내 Google 캘린더에 바로 들어가요.'],
 [MailCheck,'확정·변경·취소 알림','예약자와 나에게 이메일로 바로 알려드려요.'],
 [BellRing,'리마인더로 노쇼 방지','하루 전, 1시간 전에 미팅을 다시 알려줘요.'],
 [RefreshCw,'예약자 셀프 변경·취소','메일 속 링크로 예약자가 직접 시간을 바꿔요.'],
 [Users,'여러 명 일정 투표','후보 시간을 모아 모두가 되는 시간을 찾아요.'],
 [SlidersHorizontal,'예약 규칙','최소 예약 시간과 하루 최대 예약 수를 정해요.'],
 [Car,'이동 시간 확보','오프라인 미팅 앞뒤로 이동 시간을 비워 둬요.'],
 [Building2,'회사명 · 미팅 제목','상대 회사명을 받아 미팅 제목을 자동으로 만들어요.'],
] as const;
export default function Landing(){return <div className={s.page}>
<script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify([{'@context':'https://schema.org','@type':'WebSite',name:'모아타임',url:siteUrl,inLanguage:'ko-KR',description:'Google 캘린더 기반 일정 예약 서비스'},{'@context':'https://schema.org','@type':'SoftwareApplication',name:'모아타임',applicationCategory:'BusinessApplication',operatingSystem:'Web',url:siteUrl,offers:plans.map(p=>({'@type':'Offer',name:p.name,price:p.monthly,priceCurrency:'KRW'}))}]).replace(/</g,'\\u003c')}}/>
<a className={s.skip} href="#main">본문으로 건너뛰기</a>
<header className={s.header}><a className={s.brand} href="/" aria-label="모아타임 홈"><span className={s.mark}><CalendarDays size={21}/></span>모아타임<span className={s.brandDot}>.</span></a><nav className={s.nav} aria-label="메인 메뉴"><a href="#features">서비스 소개</a><a href="#how">이용 방법</a><a href="#pricing">요금제</a><a href="#faq">자주 묻는 질문</a></nav><div className={s.navActions}><a href="/login">로그인</a><a className={s.smallCta} href="/login">회원가입 <ArrowUpRight size={15}/></a></div></header>
<main id="main" className={s.main}>
<section className={s.hero}><div className={s.heroCopy}><span className={s.badge}><span/> Google 캘린더 · Meet 자동 연동</span><h1>일정 조율은 짧게,<br/>좋은 만남은 <span>길게.</span></h1><p>“언제 시간 괜찮으세요?” 대신 링크 하나.<br/>서로의 가능한 시간을 모아,<br className={s.mobileBreak}/> 만남에 더 집중하세요.</p><div className={s.heroActions}><a className={s.cta} href="/login">Google로 시작하기 <ArrowRight size={18}/></a><a className={s.textLink} href="#how">어떻게 사용하나요? <ChevronRight size={16}/></a></div><div className={s.heroNote}><span className={s.googleLetter}>G</span>무료로 시작 · 예약자는 로그인 없이 바로 예약</div></div>
<div className={s.heroVisual} aria-label="예약 페이지 예시"><div className={s.visualTop}><span><i/><i/><i/></span><small>moatime / your-next-meeting</small><ShieldCheck size={14}/></div><div className={s.preview}><div className={s.meeting}><div className={s.profileIcon}>M<span/></div><small>모아타임</small><h2>우리, 잠깐<br/>이야기 나눠요.</h2><p>새로운 아이디어가 시작되는<br/>가벼운 커피챗 ☕</p><span><Clock3 size={14}/>30분</span><span><Video size={14}/>온라인 미팅</span><div className={s.previewLabel}>예약 화면 예시</div></div><div className={s.calendar}><div className={s.calendarHeading}><b>편한 시간을 선택하세요</b><CalendarDays size={16}/></div><p>2026년 10월 <span>‹　›</span></p><div className={s.calendarGrid}>{['월','화','수','목','금','토','일'].map(d=><small key={d}>{d}</small>)}{Array.from({length:28},(_,i)=><span className={i===13?s.selectedDay:i>9&&i<19?s.availableDay:''} key={i}>{i+1}</span>)}</div><div className={s.times}><span>10:00</span><span className={s.selectedTime}>14:00 <Check size={12}/></span><span>16:30</span></div><small className={s.timezone}>Asia/Seoul · 한국 표준시</small></div></div><div className={s.floatingNote}><span><CalendarCheck size={20}/></span><div><b>딱 맞는 시간을 찾았어요!</b><small>10월 14일 · 오후 2:00</small></div><Check size={16}/></div><span className={s.orbitOne}/><span className={s.orbitTwo}/></div></section>
<div className={s.useCases}><p>시간을 맞춰야 하는 모든 순간에</p><div><span>☕ 커피챗</span><span>✦ 프로젝트 상담</span><span>◈ 서비스 데모</span><span>↗ 파트너 미팅</span></div></div>
<section id="features" className={s.features}><div className={s.sectionHeading}><span className={s.eyebrow}>LESS BACK AND FORTH</span><h2>주고받는 메시지는 줄이고,<br/>함께하는 시간은 늘리고.</h2><p>약속 하나를 잡기 위해 여러 번 확인하지 않아도 되도록.</p></div><div className={s.featureGrid}><article className={s.featureCard}><span className={s.featureIcon}><CalendarDays/></span><h3>내 캘린더에 맞춰,<br/>가능한 시간만.</h3><p>Google 캘린더의 바쁜 시간을 제외하고<br/>새로운 만남이 가능한 시간을 보여줍니다.</p><div className={s.busyDemo}><span>10:00 <i>기존 일정</i></span><span>11:00 <b>예약 가능 <Check size={13}/></b></span><span>14:00 <i>기존 일정</i></span></div></article><article className={s.featureCard}><span className={s.featureIcon}><Link2/></span><h3>설명은 간단하게,<br/>공유는 링크 하나로.</h3><p>미팅 목적과 시간을 정해 예약 페이지를 만들고,<br/>메신저나 이메일로 링크를 전달하세요.</p><div className={s.linkDemo}><span>moatime / coffee-chat</span><Link2 size={17}/></div><div className={s.tagRow}><span>커피챗</span><span>30분</span><span>온라인</span></div></article><article className={s.featureCard}><span className={s.featureIcon}><Users/></span><h3>혼자 하는 일부터,<br/>함께하는 미팅까지.</h3><p>상담, 커피챗, 서비스 소개까지.<br/>만남의 목적에 맞는 예약 페이지를 관리하세요.</p><div className={s.stackDemo}><span><i>☕</i>가볍게 나누는 커피챗<small>30분</small></span><span><i>✦</i>프로젝트 상담<small>60분</small></span></div></article></div></section>
<section id="all-features" className={s.allFeatures}><div className={s.sectionHeading}><span className={s.eyebrow}>EVERYTHING YOU NEED</span><h2>예약 이후까지,<br/>모아타임이 챙겨요.</h2><p>링크 공유부터 알림, 일정 변경까지 한곳에서.</p></div><div className={s.allFeatureGrid}>{allFeatures.map(([Icon,t,d])=><div key={t}><span><Icon size={20}/></span><h3>{t}</h3><p>{d}</p></div>)}</div></section>
<section id="how" className={s.how}><div className={s.howIntro}><span className={s.eyebrow}>SIMPLE AS ONE, TWO, THREE</span><h2>다음 만남까지,<br/>세 단계면 충분해요.</h2><p>복잡한 설정 대신<br/>나에게 맞는 예약 흐름을 만들어보세요.</p><a className={s.textLink} href="/login">내 예약 페이지 만들기 <ArrowRight size={17}/></a></div><ol className={s.steps}>{[['01','나의 가능한 시간을 정해요','Google 계정을 연결하고, 미팅을 받을 요일과 시간을 설정하세요.'],['02','예약 링크를 공유해요','커피챗, 상담 등 목적에 맞는 예약 페이지를 만들어 전달하세요.'],['03','선택한 시간에 만나요','상대방이 로그인 없이 시간을 고르면 내 Google 캘린더에 Meet 링크와 함께 자동으로 등록돼요.']].map(([n,t,d])=><li key={n}><span>{n}</span><div><h3>{t}</h3><p>{d}</p></div></li>)}</ol></section>
<section id="pricing" className={s.pricing}><div className={s.sectionHeading}><span className={s.eyebrow}>SIMPLE PRICING</span><h2>필요한 만큼만,<br/>부담 없는 가격으로.</h2><p>무료로 시작하고, 미팅이 많아지면 프로로 바꾸세요.</p></div><PricingTable/></section>
<section id="faq" className={s.faq}><div className={s.sectionHeading}><span className={s.eyebrow}>GOOD TO KNOW</span><h2>궁금한 점이 있으신가요?</h2></div><div>{faqs.map(([q,a])=><details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</div></section>
<section className={s.finalCta}><span className={s.eyebrow}>MAKE TIME FOR WHAT MATTERS</span><h2>시간을 맞추는 일보다,<br/>함께할 이야기에 집중하세요.</h2><a className={s.cta} href="/login">나의 첫 예약 페이지 만들기 <ArrowRight size={18}/></a><p>Google 계정으로 시작하는 더 간편한 일정 조율</p></section>
</main><footer className={s.footer}><div><a className={s.brand} href="/"><span className={s.mark}><CalendarDays size={19}/></span>모아타임<span className={s.brandDot}>.</span></a><p>시간을 모아, 더 좋은 만남으로.</p></div><div><a href="#features">서비스 소개</a><a href="#pricing">요금제</a><a href="#faq">자주 묻는 질문</a><a href="/login">로그인 / 회원가입</a><a href="/terms">이용약관</a><a href="/privacy"><strong>개인정보 처리방침</strong></a></div><small>© {new Date().getFullYear()} 모아타임</small></footer><div className={s.businessWrap}><BusinessInfo/></div></div>}
