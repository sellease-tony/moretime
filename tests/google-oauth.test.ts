import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {authorizeUrl,exchangeCode,guestNext,newFlow,readFlow,redirectUri,sha256hex,GUEST_SCOPES,HOST_SCOPES} from '../lib/auth/google-oauth';
const origin='https://moretime.sellease.io';

test('host sign-in returns to our own callback with PKCE, offline access and a hashed nonce',()=>{
 const flow=newFlow({consent:'2026-10-12'});
 const u=new URL(authorizeUrl(flow,'client-1',origin));
 assert.equal(u.origin+u.pathname,'https://accounts.google.com/o/oauth2/v2/auth');
 const q=u.searchParams;
 assert.equal(q.get('redirect_uri'),'https://moretime.sellease.io/auth/google/callback');
 assert.doesNotMatch(u.href,/supabase/);
 assert.equal(q.get('scope'),HOST_SCOPES);
 assert.equal(q.get('access_type'),'offline');assert.equal(q.get('prompt'),'consent');
 assert.equal(q.get('state'),flow.state);
 assert.equal(q.get('code_challenge'),createHash('sha256').update(flow.verifier).digest('base64url'));
 assert.equal(q.get('nonce'),sha256hex(flow.nonce));
 assert.notEqual(q.get('nonce'),flow.nonce);
});

test('guest prefill asks only for profile scopes and no offline access',()=>{
 const q=new URL(authorizeUrl(newFlow({next:'/book/a0000000-0000-4000-8000-000000000001'}),'client-1',origin)).searchParams;
 assert.equal(q.get('scope'),GUEST_SCOPES);
 assert.equal(q.get('access_type'),null);
 assert.equal(q.get('prompt'),'select_account');
});

test('only exact booking pages are accepted as a guest return path',()=>{
 assert.equal(guestNext('/book/a0000000-0000-4000-8000-000000000001'),'/book/a0000000-0000-4000-8000-000000000001');
 for(const bad of ['/app','//evil.example','/book/x','https://evil.example/book/a0000000-0000-4000-8000-000000000001',null])assert.equal(guestNext(bad),undefined);
});

test('flow cookie must carry state, verifier and nonce',()=>{
 const flow=newFlow({});
 assert.deepEqual(readFlow(JSON.stringify(flow)),flow);
 for(const bad of [undefined,'','{','{"state":"x"}','null'])assert.equal(readFlow(bad),null);
 assert.notEqual(newFlow({}).state,flow.state);
});

test('code exchange sends the verifier and the same redirect URI, and rejects incomplete replies',async()=>{
 process.env.GOOGLE_CLIENT_ID='client-1';process.env.GOOGLE_CLIENT_SECRET='secret-1';
 const flow=newFlow({});let sent:URLSearchParams|undefined;
 const ok=(async(_u:unknown,init?:RequestInit)=>{sent=init?.body as URLSearchParams;return Response.json({id_token:'id',access_token:'at',refresh_token:'rt'})}) as typeof fetch;
 assert.deepEqual(await exchangeCode('c',flow,origin,ok),{id_token:'id',access_token:'at',refresh_token:'rt'});
 assert.equal(sent?.get('code_verifier'),flow.verifier);
 assert.equal(sent?.get('redirect_uri'),redirectUri(origin));
 const bad=(async()=>Response.json({access_token:'at'})) as typeof fetch;
 await assert.rejects(exchangeCode('c',flow,origin,bad));
 const denied=(async()=>Response.json({error:'invalid_grant'},{status:400})) as typeof fetch;
 await assert.rejects(exchangeCode('c',flow,origin,denied));
});
