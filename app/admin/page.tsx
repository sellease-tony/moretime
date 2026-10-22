import Link from 'next/link';
import {dashboard} from '@/lib/admin/data';
import {billingOpen,statusLabel,type SubscriptionStatus} from '@/lib/billing/plan';
import {won} from '@/lib/plans';
import {fmtDate} from './format';
import s from './admin.module.css';

export const dynamic='force-dynamic';

export default async function AdminHome(){
 const d=await dashboard();
 const stats:[string,string,string?][]=[
  ['전체 주최자',d.hosts+'명',`최근 7일 +${d.new7d} · 30일 +${d.new30d}`],
  ['30일 활성 주최자',d.active30d+'명','로그인 또는 예약 발생 기준'],
  ['누적 예약',d.bookings+'건',`최근 30일 ${d.bookings30d}건`],
  ['캘린더 연결',d.calendarConnected+'명',d.calendarErrors?`동기화 오류 ${d.calendarErrors}명`:'동기화 오류 없음'],
  ['유료 구독자',d.paying+'명','이용 중 + 결제 실패'],
  ['MRR',won(d.mrr),'연간 결제는 월 환산'],
  ['이번 달 결제',won(d.paidThisMonth),`실패 ${d.failedThisMonth}건`],
  ['이번 달 환불',won(d.refundedThisMonth)],
 ];
 const statuses=Object.entries(d.byStatus).sort((a,b)=>b[1]-a[1]);
 return <>
  <h1>대시보드</h1><p className={s.lead}>가입·예약·구독 현황을 한눈에 봅니다.</p>
  {!billingOpen()&&<div className={s.banner}>결제 오픈 전(베타)입니다. 지금은 모든 주최자가 프로 기능을 씁니다. 결제를 열 때 환경변수 <b>BILLING_OPEN=true</b>로 바꿉니다.</div>}
  <div className={s.stats}>{stats.map(([label,value,sub])=><div key={label} className={s.stat}><small>{label}</small><strong>{value}</strong>{sub&&<span>{sub}</span>}</div>)}</div>
  <div className={s.grid2}>
   <section className={s.card}><h2>구독 상태</h2>{statuses.length?<table className={s.table}><tbody>{statuses.map(([k,n])=><tr key={k}><td>{k==='none'?'구독 기록 없음(무료)':statusLabel[k as SubscriptionStatus]||k}</td><td style={{textAlign:'right'}}><b>{n}</b>명</td></tr>)}</tbody></table>:<p className={s.empty}>아직 주최자가 없습니다.</p>}</section>
   <section className={s.card}><h2>최근 가입</h2>{d.recent.length?<table className={s.table}><tbody>{d.recent.map(r=><tr key={r.id}><td><Link href={`/admin/users/${r.id}`}>{r.email}</Link><div className={s.muted}>{r.name}</div></td><td className={s.muted}>{fmtDate(r.createdAt)}</td></tr>)}</tbody></table>:<p className={s.empty}>아직 주최자가 없습니다.</p>}</section>
  </div>
 </>;
}
