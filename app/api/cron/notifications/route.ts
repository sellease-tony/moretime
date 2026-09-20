import {timingSafeEqual} from 'node:crypto';
import {processNotifications} from '@/lib/notifications/worker';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request:Request){
  const secret=process.env.CRON_SECRET;
  const actual=Buffer.from(request.headers.get('authorization')||''),expected=Buffer.from(`Bearer ${secret||''}`);
  if(!secret||actual.length!==expected.length||!timingSafeEqual(actual,expected))return Response.json({error:'Unauthorized'},{status:401});
  try{return Response.json({processed:await processNotifications()},{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'Queue processing failed'},{status:503})}
}
