import 'server-only';
import {adminClient} from '@/lib/supabase/server';
import {ownerConnection,type CalendarConnection} from './server';
import {syncGoogleEvent,type CalendarBooking} from './events';
import {syncMicrosoftEvent} from './microsoft';
import {siteUrl} from '@/lib/site';

// One write to the host's calendar, whichever provider it is. Microsoft events are tracked by the stored event ID.
async function write(c:CalendarConnection,booking:CalendarBooking,cancelled:boolean,eventId:string|null){
 if(c.provider==='microsoft')return syncMicrosoftEvent(c.access,booking,cancelled,eventId);
 const {meetUrl}=await syncGoogleEvent(c.access,booking,cancelled);
 return {eventId:null,meetUrl};
}

// The booking ledger is the durable desired state. Failed writes can be reconciled
// without creating duplicate events; a cancellation is also retained in the ledger.
export async function syncBooking(owner:string,id:string,connection?:CalendarConnection){
  try{
    const db=adminClient();
    const {data,error}=await db.from('moa_bookings').select('payload,status,calendar_event_id').eq('owner_id',owner).eq('id',id).single();
    if(error||!data)throw Error('예약을 확인하지 못했습니다.');
    const c=connection||await ownerConnection(owner);
    const booking={...data.payload,hostLink:`${siteUrl}/app?booking=${id}`};
    const first=await write(c,booking,data.status==='cancelled',data.calendar_event_id||null),meetUrl=first.meetUrl;let eventId=first.eventId;
    // A cancellation can commit while an insertion is in flight.
    const latest=await db.from('moa_bookings').select('status').eq('owner_id',owner).eq('id',id).single();
    if(latest.error)throw Error('예약 상태를 다시 확인해야 합니다.');
    if(data.status!=='cancelled'&&latest.data.status==='cancelled')({eventId}=await write(c,booking,true,eventId));
    // Keep the Meet/Teams link for emails and the guest's booking page; only a live booking carries one.
    const done={calendar_pending:false,...(c.provider==='microsoft'?{calendar_event_id:eventId}:{}),...(latest.data.status==='confirmed'&&meetUrl?{meet_url:meetUrl}:{})};
    const {error:doneError}=await db.from('moa_bookings').update(done).eq('id',id).eq('owner_id',owner).eq('status',latest.data.status);
    if(doneError)throw Error('캘린더 처리 결과 저장 실패');
    return {synced:true};
  }catch{return {synced:false};}
}
