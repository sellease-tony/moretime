import PollPage from '@/components/poll-page';
export const metadata={title:'일정 투표 | 모아타임',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{id:string}>}){return <PollPage id={(await params).id}/>}
