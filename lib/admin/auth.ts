import 'server-only';
import {notFound} from 'next/navigation';
import {currentUser} from '@/lib/supabase/server';

// Back-office access is an allowlist of Supabase user IDs (not emails) on top of the host session.
// ADMIN_USER_IDS overrides the default; an explicitly empty value disables the back office.
const DEFAULT_ADMINS='efae98c4-fbcf-4849-bdb0-2aa0eafe56b8'; // tony@sellease.io
const allowlist=()=>(process.env.ADMIN_USER_IDS??DEFAULT_ADMINS).split(',').map(id=>id.trim()).filter(Boolean);
export const isAdminId=(id:string|null|undefined)=>!!id&&allowlist().includes(id);

export async function adminUser(){
 const user=await currentUser();
 return user&&isAdminId(user.id)?user:null;
}
// Every admin page and action calls this itself: layouts are not a security boundary. Non-admins get a plain 404.
export async function requireAdmin(){
 const user=await adminUser();
 if(!user)notFound();
 return user;
}
