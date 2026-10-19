// Google sign-in handled by moretime itself, so Google's consent screen and redirect stay on our own domain.
// The server exchanges the code and hands the ID token to Supabase (signInWithIdToken) to create the session.
import {createHash,randomBytes} from 'node:crypto';

export const FLOW_COOKIE='moa_oauth';
export const HOST_SCOPES='openid email profile https://www.googleapis.com/auth/calendar.events.freebusy https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events.owned';
export const GUEST_SCOPES='openid email profile';
const GUEST_NEXT=/^\/book\/[a-f0-9-]{36}$/;

// What survives the round trip to Google; stored in an httpOnly cookie scoped to /auth.
export type Flow={state:string;verifier:string;nonce:string;next?:string;consent?:string};

const b64url=(b:Buffer)=>b.toString('base64url');
export const sha256hex=(s:string)=>createHash('sha256').update(s).digest('hex');
export function guestNext(next:string|null|undefined){return next&&GUEST_NEXT.test(next)?next:undefined}
export function newFlow(extra:Pick<Flow,'next'|'consent'>):Flow{
 return {state:b64url(randomBytes(24)),verifier:b64url(randomBytes(48)),nonce:b64url(randomBytes(24)),...extra};
}
export function readFlow(raw:string|undefined):Flow|null{
 try{const f=JSON.parse(raw||'');return typeof f?.state==='string'&&typeof f.verifier==='string'&&typeof f.nonce==='string'?f:null}catch{return null}
}
export function redirectUri(origin:string){return new URL('/auth/google/callback',origin).href}

export function authorizeUrl(flow:Flow,clientId:string,origin:string){
 const guest=!!flow.next;
 const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 u.search=new URLSearchParams({
  client_id:clientId,redirect_uri:redirectUri(origin),response_type:'code',scope:guest?GUEST_SCOPES:HOST_SCOPES,
  state:flow.state,code_challenge:b64url(createHash('sha256').update(flow.verifier).digest()),code_challenge_method:'S256',
  // Supabase compares the SHA-256 of the raw nonce with the ID token's nonce claim.
  nonce:sha256hex(flow.nonce),
  ...(guest?{prompt:'select_account'}:{prompt:'consent',access_type:'offline',include_granted_scopes:'true'}),
 }).toString();
 return u.href;
}

export type GoogleTokens={id_token:string;access_token:string;refresh_token?:string};
export async function exchangeCode(code:string,flow:Flow,origin:string,request:typeof fetch=fetch):Promise<GoogleTokens>{
 const r=await request('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({
  code,client_id:process.env.GOOGLE_CLIENT_ID!,client_secret:process.env.GOOGLE_CLIENT_SECRET!,redirect_uri:redirectUri(origin),grant_type:'authorization_code',code_verifier:flow.verifier,
 }),signal:AbortSignal.timeout(10000),cache:'no-store'});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||typeof d.id_token!=='string'||typeof d.access_token!=='string')throw new Error('Google token exchange failed');
 return {id_token:d.id_token,access_token:d.access_token,refresh_token:typeof d.refresh_token==='string'?d.refresh_token:undefined};
}
