import 'server-only';
import type {User} from '@supabase/supabase-js';
import {adminClient} from '@/lib/supabase/server';
import {isHost} from '@/lib/auth/role';
import {effectivePlan,type Subscription} from '@/lib/billing/plan';
import {plans} from '@/lib/plans';
import {requireAdmin} from './auth';

const DAY=864e5;
type Event={id:string;title:string;active:boolean};
export type HostRow={
 id:string;email:string;name:string;createdAt:string;lastSignInAt:string|null;consentVersion:string|null;
 calendarConnected:boolean;calendarProvider:string|null;calendarError:string|null;pages:number;activePages:number;openPolls:number;
 bookings:number;upcomingBookings:number;bookings30d:number;lastBookingAt:string|null;
 subscription:Subscription|null;plan:'free'|'pro';
};
export type Payment={id:string;owner_id:string;order_id:string;payment_key:string|null;amount:number;refunded_amount:number;status:string;billing_cycle:string|null;period_start:string|null;period_end:string|null;failure_reason:string|null;created_at:string};

async function allUsers(){
 const db=adminClient(),out:User[]=[];
 for(let page=1;;page++){
  const {data,error}=await db.auth.admin.listUsers({page,perPage:1000});
  if(error)throw new Error('회원 목록을 불러오지 못했습니다.');
  out.push(...data.users);
  if(data.users.length<1000)return out;
 }
}
const must=<T,>(r:{data:T|null;error:unknown},what:string)=>{if(r.error)throw new Error(what+'을(를) 불러오지 못했습니다.');return r.data as T};

async function hostRows(now=new Date()):Promise<HostRow[]>{
 const db=adminClient();
 const [users,subs,workspaces,bookings,polls,conns,jobs]=await Promise.all([
  allUsers(),
  db.from('moa_subscriptions').select('owner_id,plan,status,billing_cycle,current_period_end,trial_ends_at,cancel_at_period_end,note').then(r=>must(r,'구독')),
  db.from('moa_workspaces').select('owner_id,data').then(r=>must(r,'워크스페이스')),
  db.from('moa_bookings').select('owner_id,status,starts_at,created_at').then(r=>must(r,'예약')),
  db.from('moa_polls').select('owner_id,status').then(r=>must(r,'투표')),
  db.from('moa_google_connections').select('owner_id,provider').then(r=>must(r,'캘린더 연결')),
  db.from('moa_calendar_jobs').select('owner_id,last_error').then(r=>must(r,'캘린더 동기화')),
 ]);
 const by=<T extends {owner_id:string},>(rows:T[])=>{const m=new Map<string,T[]>();for(const r of rows)m.set(r.owner_id,[...(m.get(r.owner_id)||[]),r]);return m};
 const subMap=new Map((subs as Subscription[]).map(s=>[s.owner_id,s])),wsMap=new Map(workspaces.map(w=>[w.owner_id,w.data as {events?:Event[]}]));
 const bookingMap=by(bookings),pollMap=by(polls),connMap=new Map(conns.map(c=>[c.owner_id,c.provider as string])),jobMap=new Map(jobs.map(j=>[j.owner_id,j.last_error as string|null]));
 return users.filter(u=>isHost(u.app_metadata)).map(u=>{
  const events=wsMap.get(u.id)?.events||[],own=(bookingMap.get(u.id)||[]).filter(b=>b.status==='confirmed'),sub=subMap.get(u.id)||null;
  const consent=(u.app_metadata as {moa_consent?:{version?:string}}).moa_consent;
  return {
   id:u.id,email:u.email||'',name:String(u.user_metadata?.full_name||u.user_metadata?.name||''),createdAt:u.created_at,lastSignInAt:u.last_sign_in_at||null,
   consentVersion:consent?.version||null,calendarConnected:connMap.has(u.id),calendarProvider:connMap.get(u.id)||null,calendarError:jobMap.get(u.id)||null,
   pages:events.length,activePages:events.filter(e=>e.active).length,openPolls:(pollMap.get(u.id)||[]).filter(p=>p.status==='open').length,
   bookings:own.length,upcomingBookings:own.filter(b=>new Date(b.starts_at)>now).length,bookings30d:own.filter(b=>now.getTime()-new Date(b.created_at).getTime()<30*DAY).length,
   lastBookingAt:own.map(b=>b.created_at).sort().at(-1)||null,
   subscription:sub,plan:effectivePlan(sub,now),
  };
 }).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}

export async function listHosts(query=''){
 await requireAdmin();
 const q=query.trim().toLowerCase(),rows=await hostRows();
 return q?rows.filter(r=>r.email.toLowerCase().includes(q)||r.name.toLowerCase().includes(q)):rows;
}

export async function dashboard(now=new Date()){
 await requireAdmin();
 const db=adminClient(),rows=await hostRows(now),monthStart=new Date(now.getFullYear(),now.getMonth(),1).toISOString();
 const payments=must(await db.from('moa_payments').select('amount,refunded_amount,status,created_at').gte('created_at',monthStart),'결제') as Pick<Payment,'amount'|'refunded_amount'|'status'|'created_at'>[];
 const within=(iso:string|null,days:number)=>!!iso&&now.getTime()-new Date(iso).getTime()<days*DAY;
 const pro=plans.find(p=>p.id==='pro')!;
 const paying=rows.filter(r=>r.subscription&&['active','past_due'].includes(r.subscription.status)&&r.subscription.plan==='pro');
 const byStatus:Record<string,number>={};for(const r of rows){const k=r.subscription?.status||'none';byStatus[k]=(byStatus[k]||0)+1}
 return {
  hosts:rows.length,new7d:rows.filter(r=>within(r.createdAt,7)).length,new30d:rows.filter(r=>within(r.createdAt,30)).length,
  active30d:rows.filter(r=>within(r.lastSignInAt,30)||within(r.lastBookingAt,30)).length,
  calendarConnected:rows.filter(r=>r.calendarConnected).length,calendarErrors:rows.filter(r=>r.calendarError).length,
  bookings:rows.reduce((n,r)=>n+r.bookings,0),bookings30d:rows.reduce((n,r)=>n+r.bookings30d,0),
  paying:paying.length,mrr:paying.reduce((n,r)=>n+(r.subscription!.billing_cycle==='yearly'?pro.yearlyPerMonth:pro.monthly),0),
  paidThisMonth:payments.filter(p=>p.status!=='failed').reduce((n,p)=>n+p.amount,0),
  refundedThisMonth:payments.reduce((n,p)=>n+p.refunded_amount,0),
  failedThisMonth:payments.filter(p=>p.status==='failed').length,
  byStatus,recent:rows.slice(0,5),
 };
}

export async function hostDetail(id:string){
 await requireAdmin();
 const db=adminClient(),row=(await hostRows()).find(r=>r.id===id);
 if(!row)return null;
 const [payments,bookings,audit]=await Promise.all([
  db.from('moa_payments').select('*').eq('owner_id',id).order('created_at',{ascending:false}).limit(50).then(r=>must(r,'결제') as Payment[]),
  db.from('moa_bookings').select('id,status,starts_at,created_at,payload').eq('owner_id',id).order('starts_at',{ascending:false}).limit(20).then(r=>must(r,'예약')),
  db.from('moa_admin_audit').select('*').eq('target_owner',id).order('created_at',{ascending:false}).limit(30).then(r=>must(r,'감사 로그')),
 ]);
 return {row,payments,bookings:bookings as {id:string;status:string;starts_at:string;created_at:string;payload:{title?:string;name?:string;email?:string}}[],audit:audit as AuditEntry[]};
}

export type AuditEntry={id:number;admin_email:string;action:string;target_owner:string|null;detail:Record<string,unknown>;created_at:string};
export async function auditLog(limit=200){
 await requireAdmin();
 return must(await adminClient().from('moa_admin_audit').select('*').order('created_at',{ascending:false}).limit(limit),'감사 로그') as AuditEntry[];
}

export async function operations(now=new Date()){
 await requireAdmin();
 const db=adminClient(),since=new Date(now.getTime()-30*DAY).toISOString();
 const [jobs,calendar,pending,users]=await Promise.all([
  db.from('moa_notification_jobs').select('id,owner_id,event_type,recipient_role,status,attempts,last_error,created_at').in('status',['failed','unknown','blocked']).gte('created_at',since).order('created_at',{ascending:false}).limit(100).then(r=>must(r,'알림 작업')),
  db.from('moa_calendar_jobs').select('owner_id,last_error,last_success,next_run').not('last_error','is',null).then(r=>must(r,'캘린더 작업')),
  db.from('moa_bookings').select('id,owner_id,starts_at,created_at').eq('calendar_pending',true).eq('status','confirmed').then(r=>must(r,'캘린더 미반영 예약')),
  allUsers(),
 ]);
 const email=new Map(users.map(u=>[u.id,u.email||'']));
 return {
  failedEmails:(jobs as {id:string;owner_id:string;event_type:string;recipient_role:string;status:string;attempts:number;last_error:string|null;created_at:string}[]).map(j=>({...j,host:email.get(j.owner_id)||''})),
  calendarErrors:(calendar as {owner_id:string;last_error:string;last_success:string|null;next_run:string}[]).map(c=>({...c,host:email.get(c.owner_id)||''})),
  calendarPending:(pending as {id:string;owner_id:string;starts_at:string;created_at:string}[]).map(b=>({...b,host:email.get(b.owner_id)||''})),
 };
}
