import {createHmac,timingSafeEqual} from 'node:crypto';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function signature(id:string,secret=process.env.CALENDAR_TOKEN_ENCRYPTION_KEY){
 const key=Buffer.from(secret||'','base64');if(key.length!==32)throw Error('예약 관리 키 설정이 필요합니다.');
 return createHmac('sha256',key).update('moatime/guest-management/v1:'+id).digest('base64url');
}
export function managementToken(id:string,secret?:string){if(!uuid.test(id))throw Error('Invalid booking');return id+'.'+signature(id,secret)}
export function managementBooking(token:string,secret?:string){
 if(token.length>100)return null;
 const [id,mac,...rest]=token.split('.');if(rest.length||!uuid.test(id||'')||!mac)return null;
 const expected=Buffer.from(signature(id,secret)),actual=Buffer.from(mac);
 return expected.length===actual.length&&timingSafeEqual(expected,actual)?id:null;
}
export function managementUrl(id:string,origin=process.env.APP_URL,secret?:string){
 if(!origin)throw Error('APP_URL required');
 return new URL('/booking/manage',origin).href+'#token='+managementToken(id,secret);
}
