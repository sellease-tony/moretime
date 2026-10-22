'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {adminClient} from '@/lib/supabase/server';
import {requireAdmin} from '@/lib/admin/auth';

// Each action re-checks admin access: a Server Action is a public POST endpoint whatever page renders it.
const owner=z.string().uuid();
const note=z.string().trim().max(500).default('');
export type ActionState={ok:boolean;message:string}|null;

async function apply(ownerId:string,action:string,patch:Record<string,unknown>,detail:Record<string,unknown>):Promise<ActionState>{
 const admin=await requireAdmin(),db=adminClient();
 const {data:before}=await db.from('moa_subscriptions').select('plan,status,current_period_end,trial_ends_at,note').eq('owner_id',ownerId).maybeSingle();
 const {error}=await db.from('moa_subscriptions').upsert({owner_id:ownerId,...patch,updated_at:new Date().toISOString()});
 if(error)return {ok:false,message:'구독 정보를 저장하지 못했습니다.'};
 const {error:auditError}=await db.from('moa_admin_audit').insert({admin_id:admin.id,admin_email:admin.email,action,target_owner:ownerId,detail:{...detail,before}});
 revalidatePath('/admin',"layout");
 return auditError?{ok:true,message:'저장했지만 감사 로그를 남기지 못했습니다.'}:{ok:true,message:'저장했습니다.'};
}

export async function grantPro(_:ActionState,form:FormData):Promise<ActionState>{
 await requireAdmin();
 const p=z.object({ownerId:owner,until:z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),note}).safeParse(Object.fromEntries(form));
 if(!p.success)return {ok:false,message:'입력값을 확인해 주세요.'};
 const until=p.data.until?new Date(p.data.until+'T23:59:59+09:00'):null;
 if(until&&until.getTime()<=Date.now())return {ok:false,message:'종료일은 오늘 이후여야 합니다.'};
 return apply(p.data.ownerId,'grant_pro',{plan:'pro',status:'comped',current_period_end:until?.toISOString()||null,cancel_at_period_end:false,note:p.data.note},{until:p.data.until||'무기한',note:p.data.note});
}

export async function extendTrial(_:ActionState,form:FormData):Promise<ActionState>{
 await requireAdmin();
 const p=z.object({ownerId:owner,days:z.coerce.number().int().min(1).max(90),note}).safeParse(Object.fromEntries(form));
 if(!p.success)return {ok:false,message:'연장 일수는 1~90일로 입력해 주세요.'};
 const {data}=await adminClient().from('moa_subscriptions').select('status,trial_ends_at').eq('owner_id',p.data.ownerId).maybeSingle();
 const base=Math.max(Date.now(),data?.status==='trialing'&&data.trial_ends_at?new Date(data.trial_ends_at).getTime():0);
 const ends=new Date(base+p.data.days*864e5).toISOString();
 return apply(p.data.ownerId,'extend_trial',{plan:'pro',status:'trialing',trial_ends_at:ends,note:p.data.note},{days:p.data.days,trial_ends_at:ends,note:p.data.note});
}

export async function setFree(_:ActionState,form:FormData):Promise<ActionState>{
 await requireAdmin();
 const p=z.object({ownerId:owner,note}).safeParse(Object.fromEntries(form));
 if(!p.success)return {ok:false,message:'입력값을 확인해 주세요.'};
 return apply(p.data.ownerId,'set_free',{plan:'free',status:'canceled',current_period_end:null,trial_ends_at:null,cancel_at_period_end:false,note:p.data.note},{note:p.data.note});
}
