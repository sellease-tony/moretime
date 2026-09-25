import {createHash,timingSafeEqual} from 'node:crypto';
export function channelTokenHash(token:string){return createHash('sha256').update(token).digest('hex')}
export function validChannel(headers:Headers,channel:{token_hash:string;resource_id:string|null;expires_at:string},now=Date.now()){
 const token=headers.get('x-goog-channel-token')||'';
 if(!token||token.length>256||Date.parse(channel.expires_at)<=now||!Number.isFinite(Date.parse(channel.expires_at)))return false;
 const expected=Buffer.from(channel.token_hash),actual=Buffer.from(channelTokenHash(token));
 if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return false;
 const state=headers.get('x-goog-resource-state');
 if(!['sync','exists','not_exists'].includes(state||''))return false;
 // Google's initial sync can arrive before the watch response stores resourceId.
 return !!headers.get('x-goog-resource-id')&&(!channel.resource_id||channel.resource_id===headers.get('x-goog-resource-id'));
}
