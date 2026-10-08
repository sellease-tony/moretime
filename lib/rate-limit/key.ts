import {createHash} from 'node:crypto';
// Vercel sets x-real-ip and rewrites x-forwarded-for, so the first hop is the client.
export function clientIp(headers:Headers){
  const real=headers.get('x-real-ip')?.trim();if(real)return real;
  const forwarded=headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded||'unknown';
}
// Store only a hash so the counter table never holds raw IPs or link IDs.
export function rateBucket(scope:string,value:string){return scope+':'+createHash('sha256').update(scope+'\0'+value).digest('hex').slice(0,32)}
