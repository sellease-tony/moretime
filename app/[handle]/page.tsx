import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {CalendarDays,Clock3,ArrowRight,Video,MapPin} from 'lucide-react';
import {profileFor,publicLinkId} from '@/lib/handles-server';
import {prettyPath} from '@/lib/handles';
import LegalLinks from '@/components/legal-links';
import s from './profile.module.css';
export const dynamic='force-dynamic';
type Props={params:Promise<{handle:string}>};
// Host profile pages are shared by link, not meant to be found through search.
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const profile=await profileFor((await params).handle).catch(()=>null);
 return {title:profile?`${profile.name}님의 예약 페이지 · 모아타임`:'모아타임',robots:{index:false,follow:false}};
}
export default async function HostProfile({params}:Props){
 const {handle}=await params;
 const profile=await profileFor(handle).catch(()=>null);
 if(!profile)notFound();
 const links=await Promise.all(profile.events.map(async e=>({e,href:e.slug?prettyPath(handle,e.slug):`/book/${await publicLinkId(profile.owner,e.id)}`})));
 return <div className="public-booking"><a className="brand" href="/"><span className="logo"><CalendarDays/></span>모아타임.</a>
  <section className="panel public-panel host-profile"><span className="tag">BOOK A TIME</span><h1>{profile.name}</h1><p>원하는 미팅을 고르고 편한 시간을 예약하세요.</p>
   {links.length?<ul className={s.events}>{links.map(({e,href})=><li key={e.id}><a href={href}><div><strong>{e.title}</strong>{e.desc&&<p>{e.desc}</p>}<small><Clock3 size={13}/>{e.duration}분 · {e.availability?.meetingMode==='offline'?<><MapPin size={13}/>오프라인</>:<><Video size={13}/>온라인</>}</small></div><ArrowRight size={18}/></a></li>)}</ul>:<p className="notice">지금은 예약을 받고 있는 페이지가 없습니다.</p>}
  </section><LegalLinks className="legal-links public-legal"/></div>;
}
