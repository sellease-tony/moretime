// A new member signs in first and agrees to the terms on /signup afterwards. Until they agree, the calendar refresh
// token from that sign-in is not stored in the database: it waits, encrypted, in a short-lived httpOnly cookie bound
// to the signed-in user, and is discarded if they leave.
import {encryptToken,decryptToken} from '@/lib/calendar/crypto';

export const PENDING_COOKIE='moa_signup';
export const PENDING_TTL_SECONDS=600;
export type PendingSignup={uid:string;provider:'google'|'microsoft';refreshToken:string;exp:number};

export function encodePending(p:Omit<PendingSignup,'exp'>,now=Date.now()){
 return encryptToken(JSON.stringify({...p,exp:now+PENDING_TTL_SECONDS*1000}));
}
export function decodePending(raw:string|undefined,uid:string,now=Date.now()):PendingSignup|null{
 if(!raw)return null;
 try{
  const p=JSON.parse(decryptToken(raw)) as PendingSignup;
  if(p.uid!==uid||!(p.exp>now)||!['google','microsoft'].includes(p.provider)||typeof p.refreshToken!=='string'||!p.refreshToken)return null;
  return p;
 }catch{return null}
}
export const pendingCookieOptions=(secure:boolean)=>({httpOnly:true,secure,sameSite:'lax' as const,path:'/',maxAge:PENDING_TTL_SECONDS});
