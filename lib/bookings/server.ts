import 'server-only';
import {adminClient} from '@/lib/supabase/server';
import {defaultWorkspace,type Booking} from '@/lib/workspace';
import {savedSlots} from '@/lib/availability';
export async function loadOwner(owner:string){
  const db=adminClient();const [{data:row,error},{data:bookings,error:be}]=await Promise.all([db.from('moa_workspaces').select('data,revision').eq('owner_id',owner).maybeSingle(),db.from('moa_bookings').select('payload,starts_at,ends_at').eq('owner_id',owner).eq('status','confirmed')]);
  if(error||be)throw Error('예약 정보를 불러오지 못했습니다.');
  return {state:{...defaultWorkspace,...(row?.data||{})} as typeof defaultWorkspace,revision:row?.revision||0,bookings:(bookings||[]).map(b=>b.payload as Booking),busy:(bookings||[]).map(b=>({start:b.starts_at,end:b.ends_at}))};
}
export async function slotsFor(owner:string,eventId:string,day:string){
  const data=await loadOwner(owner),event=data.state.events.find(e=>e.id===eventId);
  if(!event?.active)throw Error('현재 예약을 받고 있지 않습니다.');
  return {slots:savedSlots(event.availability,day,event.duration,data.busy),event,data};
}
export function validDay(day:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;const d=new Date(day+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===day&&d.getTime()>Date.now()-86400000&&d.getTime()<Date.now()+91*86400000}
