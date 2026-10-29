import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {encodePending,decodePending,PENDING_TTL_SECONDS,pendingCookieOptions} from '../lib/auth/pending-signup';

process.env.CALENDAR_TOKEN_ENCRYPTION_KEY=randomBytes(32).toString('base64');
const uid='a0000000-0000-4000-8000-000000000001';

test('a pending sign-up only opens for the same signed-in user before it expires',()=>{
 const now=Date.now(),raw=encodePending({uid,provider:'microsoft',refreshToken:'rt-1'},now);
 assert.doesNotMatch(raw,/rt-1/);
 assert.deepEqual(decodePending(raw,uid,now+1000),{uid,provider:'microsoft',refreshToken:'rt-1',exp:now+PENDING_TTL_SECONDS*1000});
 assert.equal(decodePending(raw,'b0000000-0000-4000-8000-000000000002',now),null);
 assert.equal(decodePending(raw,uid,now+PENDING_TTL_SECONDS*1000+1),null);
});

test('tampered, foreign or empty cookies are rejected',()=>{
 const raw=encodePending({uid,provider:'google',refreshToken:'rt'});
 const parts=raw.split('.');parts[3]=parts[3].slice(0,-2)+(parts[3].endsWith('AA')?'BB':'AA');
 assert.equal(decodePending(parts.join('.'),uid),null);
 assert.equal(decodePending('v1.x.y.z',uid),null);
 assert.equal(decodePending(undefined,uid),null);
 assert.equal(decodePending('',uid),null);
});

test('the cookie is httpOnly, lax and short-lived',()=>{
 assert.deepEqual(pendingCookieOptions(true),{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:PENDING_TTL_SECONDS});
 assert.ok(PENDING_TTL_SECONDS<=900);
});
