import type {Metadata} from 'next';
import ManageBooking from '@/components/manage-booking';
export const metadata:Metadata={title:'예약 변경·취소 · 모아타임',robots:{index:false,follow:false},referrer:'no-referrer'};
export default function Page(){return <ManageBooking/>}
