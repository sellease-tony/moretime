import type {Metadata} from 'next';
import Link from 'next/link';
import {LayoutDashboard,Users,Activity,ScrollText,ArrowLeft,CalendarDays} from 'lucide-react';
import {requireAdmin} from '@/lib/admin/auth';
import {billingOpen} from '@/lib/billing/plan';
import s from './admin.module.css';

export const metadata:Metadata={title:'백오피스 · 모아타임',robots:{index:false,follow:false}};
const nav=[['/admin','대시보드',LayoutDashboard],['/admin/users','회원 · 구독',Users],['/admin/ops','운영 모니터링',Activity],['/admin/audit','감사 로그',ScrollText]] as const;

export default async function AdminLayout({children}:{children:React.ReactNode}){
 const admin=await requireAdmin();
 return <div className={s.shell}>
  <aside className={s.side}>
   <Link className={s.brand} href="/admin"><span><CalendarDays size={18}/></span>모아타임 <em>Admin</em></Link>
   <nav>{nav.map(([href,label,Icon])=><Link key={href} href={href}><Icon size={17}/>{label}</Link>)}</nav>
   <div className={s.sideFoot}>
    <span className={billingOpen()?s.pillLive:s.pillBeta}>{billingOpen()?'결제 운영 중':'베타 · 전원 프로'}</span>
    <small>{admin.email}</small>
    <Link href="/app"><ArrowLeft size={14}/>모아타임 앱으로</Link>
   </div>
  </aside>
  <main className={s.main}>{children}</main>
 </div>;
}
