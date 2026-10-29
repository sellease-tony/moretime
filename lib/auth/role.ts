// Host role lives in app_metadata, which only the service role can write; guests who sign in to prefill a booking never get it.
export const HOST_ROLE='host';
// Accounts created through our Google or Microsoft (Supabase "azure") sign-in. Email/password and other providers are never accepted.
const OAUTH_PROVIDERS=['google','azure'];
export function isOAuthAccount(meta:unknown){return !!meta&&typeof meta==='object'&&OAUTH_PROVIDERS.includes(String((meta as Record<string,unknown>).provider))}
export function isHost(meta:unknown){return isOAuthAccount(meta)&&(meta as Record<string,unknown>).moa_role===HOST_ROLE}
