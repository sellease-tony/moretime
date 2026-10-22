import 'server-only';
import {notFound} from 'next/navigation';
import {currentUser} from '@/lib/supabase/server';

// Back-office access is an email allowlist on top of the host session (Google-verified email). Override with ADMIN_EMAILS.
const allowlist=()=>(process.env.ADMIN_EMAILS||'tony@sellease.io').split(',').map(e=>e.trim().toLowerCase()).filter(Boolean);
export const isAdminEmail=(email:string|null|undefined)=>!!email&&allowlist().includes(email.toLowerCase());

export async function adminUser(){
 const user=await currentUser();
 return user&&isAdminEmail(user.email)?user:null;
}
// Every admin page and action calls this itself: layouts are not a security boundary. Non-admins get a plain 404.
export async function requireAdmin(){
 const user=await adminUser();
 if(!user)notFound();
 return user;
}
