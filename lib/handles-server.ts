import 'server-only';
import {adminClient} from '@/lib/supabase/server';
import {loadOwner} from '@/lib/bookings/server';
import {handleError,HANDLE_RE,SLUG_RE} from './handles';

export async function handleOf(owner:string){
 const {data,error}=await adminClient().from('moa_profiles').select('handle').eq('owner_id',owner).maybeSingle();
 if(error)throw Error('예약 주소를 확인하지 못했습니다.');
 return (data?.handle as string)||null;
}
export async function ownerByHandle(handle:string){
 if(!HANDLE_RE.test(handle))return null;
 const {data,error}=await adminClient().from('moa_profiles').select('owner_id').eq('handle',handle).maybeSingle();
 if(error)throw Error('예약 주소를 확인하지 못했습니다.');
 return (data?.owner_id as string)||null;
}
export async function setHandle(owner:string,raw:string):Promise<{ok:true;handle:string}|{ok:false;error:string;status:number}>{
 const handle=raw.trim().toLowerCase(),invalid=handleError(handle);
 if(invalid)return {ok:false,error:invalid,status:400};
 const {error}=await adminClient().from('moa_profiles').upsert({owner_id:owner,handle,updated_at:new Date().toISOString()},{onConflict:'owner_id'});
 if(error)return error.code==='23505'?{ok:false,error:'이미 다른 분이 쓰고 있는 주소입니다.',status:409}:{ok:false,error:'예약 주소를 저장하지 못했습니다.',status:503};
 return {ok:true,handle};
}
// The public link row for a page (same IDs the /book/{id} links use), created on first use.
export async function publicLinkId(owner:string,eventId:string){
 const {data,error}=await adminClient().from('moa_public_links').upsert({owner_id:owner,event_id:eventId},{onConflict:'owner_id,event_id'}).select('id').single();
 if(error||!data)throw Error('예약 링크를 만들지 못했습니다.');
 return data.id as string;
}
type PublicEvent={id:string;title:string;desc:string;duration:number;active:boolean;slug?:string;availability?:{meetingMode?:'online'|'offline'}};
export async function profileFor(handle:string){
 const owner=await ownerByHandle(handle);if(!owner)return null;
 const [{state},{data:user}]=await Promise.all([loadOwner(owner),adminClient().auth.admin.getUserById(owner)]);
 const events=(state.events as PublicEvent[]).filter(e=>e.active);
 const name=String(user?.user?.user_metadata?.full_name||user?.user?.user_metadata?.name||'').slice(0,80)||handle;
 return {owner,name,events};
}
export async function resolvePage(handle:string,slug:string){
 if(!SLUG_RE.test(slug))return null;
 const profile=await profileFor(handle);if(!profile)return null;
 const event=profile.events.find(e=>e.slug===slug);if(!event)return null;
 return {linkId:await publicLinkId(profile.owner,event.id),event,name:profile.name};
}
