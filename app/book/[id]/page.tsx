import BookingPage from '@/components/public-booking';
export default async function Page({params}:{params:Promise<{id:string}>}){return <BookingPage id={(await params).id}/>}
