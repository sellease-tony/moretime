import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import BookingPage from '@/components/public-booking';
import {resolvePage} from '@/lib/handles-server';
export const dynamic='force-dynamic';
type Props={params:Promise<{handle:string;slug:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {handle,slug}=await params,page=await resolvePage(handle,slug).catch(()=>null);
 return {title:page?`${page.event.title} · ${page.name} · 모아타임`:'모아타임',robots:{index:false,follow:false}};
}
// moretime.sellease.io/{handle}/{slug}: the same booking page as /book/{id}, under the host's own address.
export default async function PrettyBooking({params}:Props){
 const {handle,slug}=await params;
 const page=await resolvePage(handle,slug).catch(()=>null);
 if(!page)notFound();
 return <BookingPage id={page.linkId}/>;
}
