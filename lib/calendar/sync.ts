import 'server-only';
import {adminClient} from '@/lib/supabase/server';
import {ownerAccessToken} from './server';
import {syncGoogleEvent} from './events';
import {siteUrl} from '@/lib/site';
// The booking ledger is the durable desired state. Failed writes can be reconciled
// without creating duplicate events; a cancellation is also retained in the ledger.
export async function syncBooking(owner:string,id:string,token?:string){
  try{
    const db=adminClient();
    const {data,error}=await db.from('moa_bookings').select('payload,status').eq('owner_id',owner).eq('id',id).single();
    if(error||!data)throw Error('예약을 확인하지 못했습니다.');
    const access=token||await ownerAccessToken(owner);
    const booking={...data.payload,hostLink:`${siteUrl}/app?booking=${id}`};
    const {meetUrl}=await syncGoogleEvent(access,booking,data.status==='cancelled');
    // A cancellation can commit while an insertion is in flight.
    const latest=await db.from('moa_bookings').select('status').eq('owner_id',owner).eq('id',id).single();
    if(latest.error)throw Error('예약 상태를 다시 확인해야 합니다.');
    if(data.status!=='cancelled'&&latest.data.status==='cancelled')await syncGoogleEvent(access,booking,true);
    // Keep the Meet link for emails and the guest's booking page; only a live booking carries one.
    const done=latest.data.status==='confirmed'&&meetUrl?{calendar_pending:false,meet_url:meetUrl}:{calendar_pending:false};
    const {error:doneError}=await db.from('moa_bookings').update(done).eq('id',id).eq('owner_id',owner).eq('status',latest.data.status);
    if(doneError)throw Error('캘린더 처리 결과 저장 실패');
    return {synced:true};
  }catch{return {synced:false};}
}
