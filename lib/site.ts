// Canonical public origin. APP_URL is set per deployment; the fallback is the production domain.
export const siteUrl=(process.env.APP_URL||'https://moretime.sellease.io').replace(/\/+$/,'');
// Hosts that served the app before the custom domain. Page visits there move to siteUrl;
// API routes stay reachable so cron jobs, webhooks and already-open tabs keep working.
export const legacyHosts=['moretime-pearl.vercel.app'];
export function legacyRedirect(url:URL,canonical=siteUrl){
 const target=new URL(canonical);
 if(!legacyHosts.includes(url.hostname)||url.hostname===target.hostname||url.pathname.startsWith('/api/'))return null;
 return new URL(url.pathname+url.search,target);
}
// Where a signed-out host was heading (e.g. a booking link from their calendar), kept briefly across Google login.
export const RETURN_COOKIE='moa_return';
const returnPath=/^\/app\?booking=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const safeReturnPath=(value:string|null|undefined)=>value&&returnPath.test(value)?value:null;
