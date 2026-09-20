import {currentUser,adminClient,supabaseConfigured} from '@/lib/supabase/server';
import {integrationStatus} from '@/lib/notifications/providers';
import {calendarConfigured} from '@/lib/calendar/server';
export const dynamic='force-dynamic';
export async function GET(){
  if(!supabaseConfigured())return Response.json({configured:false,mode:'off',jobs:[]},{headers:{'Cache-Control':'no-store'}});
  const user=await currentUser();
  if(!user)return Response.json({error:'로그인이 필요합니다.'},{status:401});
  const {data,error}=await adminClient().from('moa_notification_jobs').select('id,booking_id,event_type,channel,recipient_role,status,attempts,last_error,provider_id,created_at').eq('owner_id',user.id).order('created_at',{ascending:false}).limit(30);
  if(error)return Response.json({error:'알림 내역을 불러오지 못했습니다.'},{status:503});
  const {data:calendar}=await adminClient().from('moa_google_connections').select('owner_id').eq('owner_id',user.id).maybeSingle();
  return Response.json({...integrationStatus(),configured:true,calendar:calendarConfigured()&&!!calendar,jobs:data},{headers:{'Cache-Control':'no-store'}});
}
