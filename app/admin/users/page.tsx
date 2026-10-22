import Link from 'next/link';
import {listHosts} from '@/lib/admin/data';
import {statusLabel} from '@/lib/billing/plan';
import {fmtDate} from '../format';
import s from '../admin.module.css';

export const dynamic='force-dynamic';

export default async function AdminUsers({searchParams}:{searchParams:Promise<{q?:string}>}){
 const {q=''}=await searchParams;
 const rows=await listHosts(q);
 return <>
  <h1>회원 · 구독</h1><p className={s.lead}>주최자 {rows.length}명{q&&` · "${q}" 검색 결과`}</p>
  <form className={s.search} action="/admin/users"><input name="q" defaultValue={q} placeholder="이메일 또는 이름 검색" aria-label="회원 검색"/><button>검색</button>{q&&<Link className={s.btn} href="/admin/users">초기화</Link>}</form>
  <section className={s.card}><div className={s.tableWrap}>{rows.length?<table className={s.table}>
   <thead><tr><th>주최자</th><th>가입일</th><th>플랜</th><th>예약 페이지</th><th>예약</th><th>캘린더</th><th>최근 로그인</th></tr></thead>
   <tbody>{rows.map(r=><tr key={r.id}>
    <td><Link href={`/admin/users/${r.id}`}>{r.email}</Link><div className={s.muted}>{r.name}</div></td>
    <td className={s.muted}>{fmtDate(r.createdAt)}</td>
    <td><span className={r.plan==='pro'?s.tagPro:s.tag}>{r.plan==='pro'?'프로':'무료'}</span>{r.subscription&&<div className={s.muted}>{statusLabel[r.subscription.status]}</div>}</td>
    <td>{r.activePages}<span className={s.muted}> / {r.pages}</span>{r.openPolls>0&&<div className={s.muted}>투표 {r.openPolls}</div>}</td>
    <td>{r.bookings}<div className={s.muted}>30일 {r.bookings30d} · 예정 {r.upcomingBookings}</div></td>
    <td>{!r.calendarConnected?<span className={s.tagWarn}>미연결</span>:r.calendarError?<span className={s.tagWarn}>오류</span>:<span className={s.tagOk}>정상</span>}</td>
    <td className={s.muted}>{fmtDate(r.lastSignInAt)}</td>
   </tr>)}</tbody></table>:<p className={s.empty}>{q?'검색 결과가 없습니다.':'아직 주최자가 없습니다.'}</p>}</div></section>
 </>;
}
