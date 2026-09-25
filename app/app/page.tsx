import type {Metadata} from 'next';
import {redirect} from 'next/navigation';
import {currentUser} from '@/lib/supabase/server';
import Workspace from '@/components/workspace';
export const metadata:Metadata={title:'내 워크스페이스 · 모아타임',robots:{index:false,follow:false}};
export default async function AppPage(){
  if(!await currentUser())redirect('/');
  return <Workspace/>;
}
