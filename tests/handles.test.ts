import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {handleError,slugError,suggestSlug,prettyPath} from '../lib/handles';
import {eventSchema} from '../lib/workspace';

test('handles are 3–30 lowercase letters, digits and inner hyphens, and app paths are reserved',()=>{
 for(const ok of ['tony','sellease-team','a1b','x'.repeat(30)])assert.equal(handleError(ok),null,ok);
 for(const bad of ['to','-tony','tony-','to--ny','Tony!','x'.repeat(31),'한글이름'])assert.ok(handleError(bad),bad);
 for(const reserved of ['app','admin','login','signup','book','api','auth','privacy','terms','moretime','sellease','robots','zzpreview'])assert.match(String(handleError(reserved)),/사용할 수 없는/,reserved);
 assert.equal(handleError('  Tony '),null,'input is trimmed and lowercased');
});

test('page addresses and suggestions',()=>{
 assert.equal(slugError('coffee'),null);assert.equal(slugError('30-min-chat'),null);
 for(const bad of ['','-x','x-','a--b','Coffee','커피','x'.repeat(41)])assert.ok(slugError(bad),bad);
 assert.equal(suggestSlug('Coffee Chat!'),'coffee-chat');
 assert.equal(suggestSlug('가볍게 나누는 커피챗'),'');
 assert.equal(suggestSlug('30분 Coffee'),'30-coffee');
 assert.equal(prettyPath('tony','coffee'),'/tony/coffee');
 const event={id:'e',title:'상담',desc:'',duration:30,color:'blue',team:false,active:true};
 assert.equal(eventSchema.safeParse({...event,slug:'coffee'}).success,true);
 assert.equal(eventSchema.safeParse({...event,slug:'Bad Slug'}).success,false);
 assert.equal(eventSchema.safeParse({...event,slug:'a--b'}).success,false);
});

test('PostgreSQL: one handle per host, unique across hosts, format enforced, service role only',async()=>{
 const db=new PGlite();
 await db.exec("create schema auth;create role anon;create role authenticated;create role service_role bypassrls;create table auth.users(id uuid primary key,email text);");
 await db.exec(await readFile('supabase/migrations/202610300002_profiles.sql','utf8'));
 await db.exec("insert into auth.users values ('00000000-0000-4000-8000-000000000001','a@x.io'),('00000000-0000-4000-8000-000000000002','b@x.io');insert into moa_profiles(owner_id,handle) values ('00000000-0000-4000-8000-000000000001','tony')");
 await assert.rejects(db.exec("insert into moa_profiles(owner_id,handle) values ('00000000-0000-4000-8000-000000000002','tony')"),/duplicate|unique/);
 await assert.rejects(db.exec("insert into moa_profiles(owner_id,handle) values ('00000000-0000-4000-8000-000000000002','Bad_Handle')"));
 await assert.rejects(db.exec("insert into moa_profiles(owner_id,handle) values ('00000000-0000-4000-8000-000000000002','a--b')"));
 const priv=await db.query<{a:boolean;u:boolean}>("select has_table_privilege('anon','public.moa_profiles','select') a,has_table_privilege('authenticated','public.moa_profiles','select') u");
 assert.deepEqual(priv.rows[0],{a:false,u:false});
});
