// Host role lives in app_metadata, which only the service role can write; guests who sign in to prefill a booking never get it.
export const HOST_ROLE='host';
export function isGoogle(meta:unknown){return !!meta&&typeof meta==='object'&&(meta as Record<string,unknown>).provider==='google'}
export function isHost(meta:unknown){return isGoogle(meta)&&(meta as Record<string,unknown>).moa_role===HOST_ROLE}
