import type {PlanId} from '@/lib/plans';

export type SubscriptionStatus='trialing'|'active'|'past_due'|'canceled'|'comped';
export type Subscription={
 owner_id:string;plan:PlanId;status:SubscriptionStatus;billing_cycle:'monthly'|'yearly'|null;
 current_period_end:string|null;trial_ends_at:string|null;cancel_at_period_end:boolean;note?:string;
};
// Payments stay closed until BILLING_OPEN=true; until then every host gets Pro (the beta promise on the landing page).
export const billingOpen=()=>process.env.BILLING_OPEN==='true';
// A failed renewal keeps Pro for a few days while the charge is retried.
export const PAST_DUE_GRACE_DAYS=3;

const after=(iso:string|null|undefined,now:Date,graceDays=0)=>!!iso&&new Date(iso).getTime()+graceDays*864e5>now.getTime();

export function effectivePlan(sub:Subscription|null|undefined,now=new Date(),open=billingOpen()):PlanId{
 if(!open)return 'pro';
 if(!sub)return 'free';
 switch(sub.status){
  case 'comped':return !sub.current_period_end||after(sub.current_period_end,now)?'pro':'free';
  case 'trialing':return after(sub.trial_ends_at,now)?'pro':'free';
  case 'active':return sub.plan==='pro'&&after(sub.current_period_end,now)?'pro':'free';
  case 'past_due':return sub.plan==='pro'&&after(sub.current_period_end,now,PAST_DUE_GRACE_DAYS)?'pro':'free';
  default:return 'free';
 }
}

export const statusLabel:Record<SubscriptionStatus,string>={trialing:'체험 중',active:'이용 중',past_due:'결제 실패',canceled:'해지됨',comped:'수동 부여'};
