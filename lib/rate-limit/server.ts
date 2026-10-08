import 'server-only';
import {adminClient} from '@/lib/supabase/server';
import {rateBucket} from './key';
export type RateRule={scope:string;value:string;limit:number};
// Fails closed: if the counter cannot be checked the public write is refused.
export async function allowRequest(rules:RateRule[],windowSeconds=3600){
  const {data,error}=await adminClient().rpc('moa_hit_rate_limits',{p_buckets:rules.map(r=>rateBucket(r.scope,r.value)),p_limits:rules.map(r=>r.limit),p_window_seconds:windowSeconds});
  if(error)throw Error('요청 제한을 확인하지 못했습니다.');
  return data===true;
}
