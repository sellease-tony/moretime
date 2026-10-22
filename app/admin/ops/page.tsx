import Link from 'next/link';
import {operations} from '@/lib/admin/data';
import {fmtDateTime} from '../format';
import s from '../admin.module.css';

export const dynamic='force-dynamic';
const events:Record<string,string>={confirmed:'예약 확정',cancelled:'예약 취소',reminder_24h:'하루 전 리마인더',reminder_1h:'1시간 전 리마인더'};
const role=(r:string)=>r==='host'?'주최자':r.startsWith('poll:')?'투표 참석자':'예약자';

export default async function AdminOps(){
 const o=await operations();
 return <>
  <h1>운영 모니터링</h1><p className={s.lead}>최근 30일 메일 발송 실패, 캘린더 동기화 오류, 캘린더에 아직 반영되지 않은 예약입니다.</p>
  <section className={s.card}><h2>메일 발송 실패 ({o.failedEmails.length})</h2><div className={s.tableWrap}>{o.failedEmails.length?<table className={s.table}><thead><tr><th>일시</th><th>주최자</th><th>알림</th><th>상태</th><th>오류</th></tr></thead><tbody>{o.failedEmails.map(j=><tr key={j.id}><td className={s.muted}>{fmtDateTime(j.created_at)}</td><td><Link href={`/admin/users/${j.owner_id}`}>{j.host}</Link></td><td>{events[j.event_type]||j.event_type}<div className={s.muted}>{role(j.recipient_role)} · 시도 {j.attempts}회</div></td><td><span className={s.tagWarn}>{j.status}</span></td><td className={s.code}>{j.last_error||'—'}</td></tr>)}</tbody></table>:<p className={s.empty}>실패한 메일이 없습니다.</p>}</div></section>
  <section className={s.card}><h2>캘린더 동기화 오류 ({o.calendarErrors.length})</h2><div className={s.tableWrap}>{o.calendarErrors.length?<table className={s.table}><thead><tr><th>주최자</th><th>마지막 성공</th><th>다음 시도</th><th>오류</th></tr></thead><tbody>{o.calendarErrors.map(c=><tr key={c.owner_id}><td><Link href={`/admin/users/${c.owner_id}`}>{c.host}</Link></td><td className={s.muted}>{fmtDateTime(c.last_success)}</td><td className={s.muted}>{fmtDateTime(c.next_run)}</td><td className={s.code}>{c.last_error}</td></tr>)}</tbody></table>:<p className={s.empty}>동기화 오류가 없습니다.</p>}</div></section>
  <section className={s.card}><h2>캘린더 미반영 예약 ({o.calendarPending.length})</h2><div className={s.tableWrap}>{o.calendarPending.length?<table className={s.table}><thead><tr><th>주최자</th><th>예약 시작</th><th>생성</th></tr></thead><tbody>{o.calendarPending.map(b=><tr key={b.id}><td><Link href={`/admin/users/${b.owner_id}`}>{b.host}</Link></td><td>{fmtDateTime(b.starts_at)}</td><td className={s.muted}>{fmtDateTime(b.created_at)}</td></tr>)}</tbody></table>:<p className={s.empty}>모든 예약이 캘린더에 반영되었습니다.</p>}</div></section>
 </>;
}
