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
