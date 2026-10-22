import Link from 'next/link';
import {auditLog} from '@/lib/admin/data';
import {fmtDateTime,actionLabel} from '../format';
import s from '../admin.module.css';

export const dynamic='force-dynamic';

export default async function AdminAudit(){
 const log=await auditLog();
 return <>
  <h1>감사 로그</h1><p className={s.lead}>관리자가 회원 플랜을 바꾼 기록입니다. 최근 200건까지 표시합니다.</p>
  <section className={s.card}><div className={s.tableWrap}>{log.length?<table className={s.table}><thead><tr><th>일시</th><th>관리자</th><th>조치</th><th>대상</th><th>내용</th></tr></thead><tbody>{log.map(a=><tr key={a.id}><td className={s.muted}>{fmtDateTime(a.created_at)}</td><td>{a.admin_email}</td><td>{actionLabel[a.action]||a.action}</td><td>{a.target_owner?<Link href={`/admin/users/${a.target_owner}`}>회원 보기</Link>:'—'}</td><td className={s.code}>{JSON.stringify({...a.detail,before:undefined})}</td></tr>)}</tbody></table>:<p className={s.empty}>아직 기록이 없습니다.</p>}</div></section>
 </>;
}
