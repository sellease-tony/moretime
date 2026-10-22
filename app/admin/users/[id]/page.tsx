import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft} from 'lucide-react';
import {hostDetail} from '@/lib/admin/data';
import {statusLabel,billingOpen} from '@/lib/billing/plan';
import {CONSENT_VERSION} from '@/lib/auth/consent';
import {won} from '@/lib/plans';
import {fmtDate,fmtDateTime,actionLabel} from '../../format';
import PlanActions from './plan-actions';
import s from '../../admin.module.css';

export const dynamic='force-dynamic';
const payStatus:Record<string,string>={paid:'결제 완료',failed:'실패',refunded:'환불',partially_refunded:'부분 환불'};

export default async function AdminUser({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/.test(id))notFound();
 const d=await hostDetail(id);
 if(!d)notFound();
 const {row:r,payments,bookings,audit}=d,sub=r.subscription;
 return <>
  <Link className={s.back} href="/admin/users"><ArrowLeft size={14}/>회원 목록</Link>
  <h1>{r.email}</h1><p className={s.lead}>{r.name||'이름 없음'} · 가입 {fmtDate(r.createdAt)} · 최근 로그인 {fmtDateTime(r.lastSignInAt)}</p>
  <div className={s.grid2}>
   <section className={s.card}><h2>계정</h2><dl className={s.kv}>
    <dt>회원 ID</dt><dd className={s.code}>{r.id}</dd>
    <dt>약관 동의</dt><dd>{r.consentVersion?<>{r.consentVersion} {r.consentVersion!==CONSENT_VERSION&&<span className={s.tagWarn}>이전 버전</span>}</>:<span className={s.tagWarn}>기록 없음</span>}</dd>
    <dt>Google 캘린더</dt><dd>{r.calendarConnected?(r.calendarError?<><span className={s.tagWarn}>동기화 오류</span><div className={s.muted}>{r.calendarError}</div></>:<span className={s.tagOk}>연결됨</span>):<span className={s.tagWarn}>미연결</span>}</dd>
    <dt>예약 페이지</dt><dd>활성 {r.activePages} / 전체 {r.pages} · 진행 중 투표 {r.openPolls}</dd>
    <dt>예약</dt><dd>누적 {r.bookings} · 최근 30일 {r.bookings30d} · 예정 {r.upcomingBookings}</dd>
   </dl></section>
   <section className={s.card}><h2>구독</h2><dl className={s.kv}>
    <dt>적용 플랜</dt><dd><span className={r.plan==='pro'?s.tagPro:s.tag}>{r.plan==='pro'?'프로':'무료'}</span>{!billingOpen()&&<span className={s.muted}> (베타: 전원 프로)</span>}</dd>
    <dt>구독 상태</dt><dd>{sub?statusLabel[sub.status]:'구독 기록 없음'}</dd>
    {sub?.billing_cycle&&<><dt>결제 주기</dt><dd>{sub.billing_cycle==='yearly'?'연간':'월간'}{sub.cancel_at_period_end&&' · 기간 종료 시 해지'}</dd></>}
    {sub?.current_period_end&&<><dt>이용 기간 종료</dt><dd>{fmtDate(sub.current_period_end)}</dd></>}
    {sub?.status==='comped'&&!sub.current_period_end&&<><dt>이용 기간 종료</dt><dd>무기한</dd></>}
    {sub?.trial_ends_at&&<><dt>체험 종료</dt><dd>{fmtDate(sub.trial_ends_at)}</dd></>}
    {sub?.note&&<><dt>메모</dt><dd>{sub.note}</dd></>}
   </dl></section>
  </div>
  <section className={s.card}><h2>플랜 조정</h2><PlanActions ownerId={r.id}/></section>
  <section className={s.card}><h2>결제 내역</h2><div className={s.tableWrap}>{payments.length?<table className={s.table}><thead><tr><th>일시</th><th>금액</th><th>상태</th><th>기간</th><th>주문번호</th></tr></thead><tbody>{payments.map(p=><tr key={p.id}><td>{fmtDateTime(p.created_at)}</td><td>{won(p.amount)}{p.refunded_amount>0&&<div className={s.muted}>환불 {won(p.refunded_amount)}</div>}</td><td>{payStatus[p.status]||p.status}{p.failure_reason&&<div className={s.muted}>{p.failure_reason}</div>}</td><td className={s.muted}>{fmtDate(p.period_start)} ~ {fmtDate(p.period_end)}</td><td className={s.code}>{p.order_id}</td></tr>)}</tbody></table>:<p className={s.empty}>결제 내역이 없습니다. 결제가 열리면 여기에 표시됩니다.</p>}</div></section>
  <div className={s.grid2}>
   <section className={s.card}><h2>최근 예약</h2>{bookings.length?<table className={s.table}><tbody>{bookings.map(b=><tr key={b.id}><td>{b.payload.title||'예약'}<div className={s.muted}>{b.payload.name} · {b.payload.email}</div></td><td className={s.muted}>{fmtDateTime(b.starts_at)}</td><td>{b.status==='confirmed'?<span className={s.tagOk}>확정</span>:<span className={s.tag}>취소</span>}</td></tr>)}</tbody></table>:<p className={s.empty}>예약이 없습니다.</p>}</section>
   <section className={s.card}><h2>관리자 조치 기록</h2>{audit.length?<table className={s.table}><tbody>{audit.map(a=><tr key={a.id}><td>{actionLabel[a.action]||a.action}<div className={s.muted}>{String(a.detail.note||'')}</div></td><td className={s.muted}>{a.admin_email}<br/>{fmtDateTime(a.created_at)}</td></tr>)}</tbody></table>:<p className={s.empty}>조치 기록이 없습니다.</p>}</section>
  </div>
 </>;
}
