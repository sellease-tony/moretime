import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyRedirect} from '../lib/site';

test('old vercel.app pages move to the custom domain, APIs and other hosts stay put',()=>{
 const canonical='https://moretime.co.kr';
 assert.equal(legacyRedirect(new URL('https://moretime-pearl.vercel.app/book/abc?x=1'),canonical)?.href,'https://moretime.co.kr/book/abc?x=1');
 assert.equal(legacyRedirect(new URL('https://moretime-pearl.vercel.app/booking/manage'),canonical)?.href,'https://moretime.co.kr/booking/manage');
 assert.equal(legacyRedirect(new URL('https://moretime-pearl.vercel.app/api/cron/calendar'),canonical),null,'cron and webhooks keep working on the old host');
 assert.equal(legacyRedirect(new URL('https://moretime.co.kr/app'),canonical),null);
 assert.equal(legacyRedirect(new URL('https://moretime-git-feature-x.vercel.app/'),canonical),null,'preview deployments are not redirected');
 assert.equal(legacyRedirect(new URL('https://moretime-pearl.vercel.app/'),'https://moretime-pearl.vercel.app'),null,'no loop while APP_URL is still the old host');
});
