import 'server-only';
import {adminClient} from '@/lib/supabase/server';
import {ownerAccessToken} from './server';
import {syncGoogleEvent} from './events';
// The booking ledger is the durable desired state. Failed writes can be reconciled
// without creating duplicate events; a cancellation is also retained in the ledger.
export async function syncBooking(owner:string,id:string,token?:string){
  try{
    const db=adminClient();
    const {data,error}=await db.from('moa_bookings').select('payload,status').eq('owner_id',owner).eq('id',id).single();
    if(error||!data)throw Error('예약을 확인하지 못했습니다.');
    const access=token||await ownerAccessToken(owner);
    await syncGoogleEvent(access,data.payload,data.status==='cancelled');
    // A cancellation can commit while an insertion is in flight.
    const latest=await db.from('moa_bookings').select('status').eq('owner_id',owner).eq('id',id).single();
    if(latest.error)throw Error('예약 상태를 다시 확인해야 합니다.');
    if(data.status!=='cancelled'&&latest.data.status==='cancelled')await syncGoogleEvent(access,data.payload,true);
    return {synced:true};
  }catch{return {synced:false};}
}
