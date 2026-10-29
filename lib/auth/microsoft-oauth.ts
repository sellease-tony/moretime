// Microsoft sign-in (work/school and personal accounts) handled like the Google flow: our own callback, PKCE, state
// and a hashed nonce, then Supabase signInWithIdToken({provider:'azure'}) creates the session.
import {createHash} from 'node:crypto';
import {sha256hex,type Flow} from './google-oauth';

const AUTHORITY='https://login.microsoftonline.com/common/oauth2/v2.0';
// offline_access returns a refresh token; Calendars.ReadWrite covers busy times, event writes and Teams links.
export const MICROSOFT_SCOPES='openid email profile offline_access User.Read Calendars.ReadWrite';
export const microsoftConfigured=()=>!!(process.env.MICROSOFT_CLIENT_ID&&process.env.MICROSOFT_CLIENT_SECRET);
export function microsoftRedirectUri(origin:string){return new URL('/auth/microsoft/callback',origin).href}

export function microsoftAuthorizeUrl(flow:Flow,clientId:string,origin:string){
 const u=new URL(AUTHORITY+'/authorize');
 u.search=new URLSearchParams({
  client_id:clientId,redirect_uri:microsoftRedirectUri(origin),response_type:'code',response_mode:'query',scope:MICROSOFT_SCOPES,
  state:flow.state,code_challenge:createHash('sha256').update(flow.verifier).digest('base64url'),code_challenge_method:'S256',
  nonce:sha256hex(flow.nonce),prompt:'select_account',
 }).toString();
 return u.href;
}

export type MicrosoftTokens={id_token:string;access_token:string;refresh_token?:string};
async function tokenRequest(body:Record<string,string>,request:typeof fetch){
 const r=await request(AUTHORITY+'/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.MICROSOFT_CLIENT_ID!,client_secret:process.env.MICROSOFT_CLIENT_SECRET!,scope:MICROSOFT_SCOPES,...body}),signal:AbortSignal.timeout(10000),cache:'no-store'});
 const d=await r.json().catch(()=>({}));
 return {ok:r.ok,d:d as Record<string,unknown>};
}
export async function exchangeMicrosoftCode(code:string,flow:Flow,origin:string,request:typeof fetch=fetch):Promise<MicrosoftTokens>{
 const {ok,d}=await tokenRequest({code,redirect_uri:microsoftRedirectUri(origin),grant_type:'authorization_code',code_verifier:flow.verifier},request);
 if(!ok||typeof d.id_token!=='string'||typeof d.access_token!=='string')throw new Error('Microsoft token exchange failed');
 return {id_token:d.id_token,access_token:d.access_token,refresh_token:typeof d.refresh_token==='string'?d.refresh_token:undefined};
}
// Microsoft may rotate the refresh token on every use; callers must store the new one when it is returned.
export async function refreshMicrosoftToken(refreshToken:string,request:typeof fetch=fetch){
 const {ok,d}=await tokenRequest({refresh_token:refreshToken,grant_type:'refresh_token'},request);
 if(!ok||typeof d.access_token!=='string')throw new Error('Microsoft token refresh failed');
 return {access_token:d.access_token,refresh_token:typeof d.refresh_token==='string'?d.refresh_token:undefined};
}
