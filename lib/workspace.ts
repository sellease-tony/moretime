import {z} from 'zod';
import type {Availability} from './availability';
type Event={id:string;title:string;desc:string;duration:number;color:string;team:boolean;active:boolean;availability?:Availability};
export const defaultEvents:Event[]=[{id:'coffee',title:'가볍게 나누는 커피챗',desc:'새로운 연결의 시작, 편하게 이야기 나눠요.',duration:30,color:'blue',team:false,active:true},{id:'project',title:'프로젝트 상담',desc:'아이디어를 함께 구체화하는 시간입니다.',duration:60,color:'purple',team:false,active:true},{id:'sync',title:'빠른 싱크업',desc:'짧고 집중해서, 필요한 이야기만 나눠요.',duration:15,color:'orange',team:false,active:true},{id:'team',title:'서비스 데모 미팅',desc:'우리 팀과 함께 서비스를 살펴보세요.',duration:30,color:'green',team:true,active:true}];
export const defaultWorkspace={events:defaultEvents,hours:[false,true,true,true,true,true,false],range:['09:00','18:00']};
const clock=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const dayKey=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v},'날짜를 확인해 주세요.');
export const availabilitySchema=z.object({days:z.record(dayKey,z.array(clock).max(96)),source:z.enum(['manual','google']),updatedAt:z.string().datetime(),importedAt:z.string().datetime().optional()}).strict().refine(v=>Object.keys(v.days).length<=91,'최대 91일을 선택할 수 있습니다.');
export const eventSchema=z.object({id:z.string().min(1).max(80),title:z.string().trim().min(1).max(60),desc:z.string().max(150),duration:z.union([z.literal(15),z.literal(30),z.literal(60)]),color:z.enum(['blue','purple','orange','green']),team:z.boolean(),active:z.boolean(),availability:availabilitySchema.optional()}).strict().superRefine((e,ctx)=>{for(const times of Object.values(e.availability?.days||{})){if(times.some(t=>minutes(t)+e.duration>1440)||new Set(times).size!==times.length)ctx.addIssue({code:'custom',message:'예약 시작 시간과 소요 시간을 확인해 주세요.'});}});
export const bookingSchema=z.object({id:z.string().uuid(),eventId:z.string().min(1).max(80),title:z.string().max(60),duration:z.union([z.literal(15),z.literal(30),z.literal(60)]),day:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),time:clock,name:z.string().trim().min(1).max(80),email:z.string().email().max(200),phone:z.string().transform(v=>v.replace(/[\s-]/g,'')).pipe(z.union([z.literal(''),z.string().regex(/^01[016789]\d{7,8}$/)])).default(''),channels:z.array(z.enum(['email','sms','kakao'])).max(3).default([]),notificationConsent:z.boolean().default(false)}).strict().superRefine((b,ctx)=>{
  const date=new Date(b.day+'T'+b.time+':00+09:00');
  if(isNaN(date.getTime())||new Date(b.day+'T00:00:00Z').toISOString().slice(0,10)!==b.day)ctx.addIssue({code:'custom',message:'날짜를 확인해 주세요.'});
  if((b.channels.includes('sms')||b.channels.includes('kakao'))&&!b.phone)ctx.addIssue({code:'custom',message:'문자·알림톡을 받으려면 휴대전화 번호가 필요합니다.'});
  if(b.channels.length&&!b.notificationConsent)ctx.addIssue({code:'custom',message:'예약 알림 수신 확인이 필요합니다.'});
  if(new Set(b.channels).size!==b.channels.length)ctx.addIssue({code:'custom',message:'중복된 알림 채널입니다.'});
});
export const workspacePatch=z.object({revision:z.number().int().nonnegative(),events:z.array(eventSchema).max(100).optional(),bookings:z.array(bookingSchema).max(500).optional(),hours:z.array(z.boolean()).length(7).optional(),range:z.tuple([clock,clock]).refine(r=>r[0]<r[1],'종료 시간이 시작 시간보다 늦어야 합니다.').optional()}).strict();
export type Booking=z.infer<typeof bookingSchema>;
export function minutes(s:string){return Number(s.slice(0,2))*60+Number(s.slice(3))}
export function validateNewBooking(b:Booking,state:typeof defaultWorkspace,now=new Date()){
  const e=state.events.find(e=>e.id===b.eventId);
  if(!e?.active||e.duration!==b.duration||e.title!==b.title)throw Error('예약 페이지 설정이 변경되었습니다. 새로고침해 주세요.');
  const date=new Date(b.day+'T'+b.time+':00+09:00'),weekday=new Date(b.day+'T12:00:00+09:00').getUTCDay();
  if(date<=now||!e.availability?.days[b.day]?.includes(b.time))throw Error('예약할 수 없는 시간입니다.');
}
