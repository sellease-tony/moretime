import 'server-only';
import {adminClient} from '@/lib/supabase/server';
import {ownerBusy} from './server';
import {addDays,kstDay} from '@/lib/availability';
import {applyCalendarBusy,type CalendarState} from './availability-state';

export async function currentCalendarBusy(owner:string){
 const today=kstDay();
 return ownerBusy(owner,new Date(today+'T00:00:00+09:00').toISOString(),new Date(addDays(today,91)+'T00:00:00+09:00').toISOString());
}
export async function syncOwnerAvailability(owner:string,force=false){
 const db=adminClient();
 const {data:initial,error}=await db.from('moa_workspaces').select('data,revision').eq('owner_id',owner).maybeSingle();
 if(error)throw Error('가능 시간 저장소를 확인하지 못했습니다.');
 if(!initial)return;
 const previous=initial.data as CalendarState;
 if(!force&&previous.calendarSync?.ok&&Date.now()-Date.parse(previous.calendarSync.checkedAt)<60000)return;
 let busy:Awaited<ReturnType<typeof currentCalendarBusy>>=[],ok=true;
 try{busy=await currentCalendarBusy(owner)}catch{ok=false}
 // Compare-and-swap uses the same revision as booking transactions. Never overwrite
 // a simultaneous host edit or a guest booking with an older workspace snapshot.
 for(let attempt=0;attempt<3;attempt++){
  const {data:row,error:readError}=attempt===0?{data:initial,error:null}:await db.from('moa_workspaces').select('data,revision').eq('owner_id',owner).single();
  if(readError||!row)throw Error('가능 시간을 불러오지 못했습니다.');
  const state=applyCalendarBusy(row.data as CalendarState,busy,new Date(),ok);
  const {data:updated,error:writeError}=await db.from('moa_workspaces').update({data:state,revision:row.revision+1,updated_at:new Date().toISOString()}).eq('owner_id',owner).eq('revision',row.revision).select('revision');
  if(writeError)throw Error('가능 시간을 갱신하지 못했습니다.');
  if(updated?.length)return ok;
  // Refresh Google data after a concurrent commit; never retry an old snapshot.
  try{busy=await currentCalendarBusy(owner);ok=true}catch{busy=[];ok=false}
 }
 throw Error('다른 변경사항이 있습니다. 잠시 후 새로고침해 주세요.');
}
