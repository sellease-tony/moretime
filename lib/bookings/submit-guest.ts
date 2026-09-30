type Result={ok:true;manageUrl?:string;meetingTitle?:string}|{ok:false;status:number;error:string};
// Retrying must reuse the same request ID: the first request may have committed
// even when its response was lost. The server already handles that idempotently.
export async function submitGuestBooking(id:string,body:unknown,fetcher:typeof fetch=fetch,timeoutMs=20000):Promise<Result>{
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetcher('/api/public/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
  let data;try{data=await response.json()}catch{return {ok:false,status:response.status,error:'서버 응답을 확인하지 못했습니다. 잠시 후 예약 확정을 다시 눌러 주세요.'}}
  if(!response.ok)return {ok:false,status:response.status,error:typeof data?.error==='string'?data.error:'예약을 완료하지 못했습니다. 다시 시도해 주세요.'};
  if(data?.ok!==true)return {ok:false,status:response.status,error:'예약 완료 여부를 확인하지 못했습니다. 다시 시도해 주세요.'};
  return {ok:true,manageUrl:data.manageUrl,meetingTitle:data.meetingTitle};
 }catch{return {ok:false,status:0,error:controller.signal.aborted?'응답이 지연되고 있습니다. 예약 확정을 다시 누르면 중복 없이 완료 여부를 확인합니다.':'네트워크 연결을 확인한 뒤 예약 확정을 다시 눌러 주세요.'}}
 finally{clearTimeout(timer)}
}
