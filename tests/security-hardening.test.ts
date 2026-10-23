import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {z} from 'zod';
import {publicMessage} from '../lib/errors';
import nextConfig from '../next.config';

test('only short Korean app messages reach clients; schema and library errors are replaced',()=>{
 assert.equal(publicMessage(new Error('후보 시간은 최대 200개입니다.'),'처리하지 못했습니다.'),'후보 시간은 최대 200개입니다.');
 assert.equal(publicMessage(new Error('relation "moa_polls" does not exist'),'처리하지 못했습니다.'),'처리하지 못했습니다.');
 const zod=z.object({email:z.string().email()}).safeParse({email:'x'});
 assert.equal(publicMessage(zod.error,'입력을 확인해 주세요.'),'입력을 확인해 주세요.');
 assert.equal(publicMessage('boom','실패'),'실패');
});

test('every route sends anti-framing and baseline security headers',async()=>{
 const rules=await nextConfig.headers!();
 const h=Object.fromEntries(rules[0].headers.map(x=>[x.key,x.value]));
 assert.equal(rules[0].source,'/:path*');
 assert.match(h['Content-Security-Policy'],/frame-ancestors 'none'/);
 assert.equal(h['X-Frame-Options'],'DENY');
 assert.equal(h['X-Content-Type-Options'],'nosniff');
 assert.ok(h['Referrer-Policy']&&h['Strict-Transport-Security']);
});

test('hosts lose truncate on billing tables and cannot read payment keys; poll emails are unique per case',async()=>{
 const db=new PGlite();
 await db.exec("create schema auth;create role anon;create role authenticated;create role service_role bypassrls;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select '00000000-0000-4000-8000-000000000001'::uuid$$;");
 for(const m of ['202609200001_moatime.sql','202609300002_polls.sql','202610230001_subscriptions.sql','202610230002_security_hardening.sql'])await db.exec(await readFile('supabase/migrations/'+m,'utf8'));
 const priv=await db.query<{t:boolean;k:boolean;a:boolean}>("select has_table_privilege('authenticated','public.moa_payments','truncate') t,has_column_privilege('authenticated','public.moa_payments','payment_key','select') k,has_column_privilege('authenticated','public.moa_payments','amount','select') a");
 assert.deepEqual(priv.rows[0],{t:false,k:false,a:true});
 const sub=await db.query<{t:boolean}>("select has_table_privilege('authenticated','public.moa_subscriptions','truncate') t");
 assert.equal(sub.rows[0].t,false);
 const unsafe=await db.query("select proname from pg_proc where pronamespace='public'::regnamespace and proname like 'moa\_%' and prosecdef and not coalesce(array_to_string(proconfig,',') like '%pg_temp%',false)");
 assert.equal(unsafe.rows.length,0);
 await db.exec("insert into auth.users values ('00000000-0000-4000-8000-000000000001','h@x.io');insert into moa_polls(id,owner_id,title,duration,expected_count,candidates) values ('00000000-0000-4000-8000-0000000000aa','00000000-0000-4000-8000-000000000001','t',30,2,'{}');insert into moa_poll_responses(id,poll_id,key_hash,name,email,choices) values ('00000000-0000-4000-8000-0000000000b1','00000000-0000-4000-8000-0000000000aa','k','a','A@x.io','{}')");
 await assert.rejects(db.exec("insert into moa_poll_responses(id,poll_id,key_hash,name,email,choices) values ('00000000-0000-4000-8000-0000000000b2','00000000-0000-4000-8000-0000000000aa','k2','b','a@X.io','{}')"));
});
