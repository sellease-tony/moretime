import Link from 'next/link';
import {ArrowLeft} from 'lucide-react';
import {legal,legalComplete,TODO} from '@/lib/legal';
import BusinessInfo from '@/components/business-info';
import s from '@/app/legal.module.css';
export function V({k}:{k:keyof typeof legal}){const v=legal[k];return v===TODO?<span className={s.todo}>[{v}]</span>:<>{v}</>}
export default function LegalDoc({title,children}:{title:string;children:React.ReactNode}){
 return <div className={s.page}><Link className={s.back} href="/"><ArrowLeft size={15}/>모아타임 홈으로</Link><article className={s.doc}><h1>{title}</h1><p className={s.meta}>{legal.service} · 시행일 <V k="effectiveDate"/></p>{!legalComplete()&&<p className={s.draft} role="note">초안입니다. 표시된 항목을 채우고 법률 검토를 마친 뒤 게시하세요.</p>}{children}<h2>사업자 정보</h2><BusinessInfo className={s.business}/></article></div>;
}
export {s as legalStyles};
