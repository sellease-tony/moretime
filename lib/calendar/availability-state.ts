import {savedSlots,type Availability} from '../availability';
import type {Busy} from './google';
type Event={id:string;duration:number;availability?:Availability};
type Selection={updatedAt:string;days:Record<string,string[]>};
export type CalendarState={events:Event[];calendarSelection?:Record<string,Selection>;calendarSync?:{checkedAt:string;ok:boolean};[key:string]:unknown};
// Preserve the host's selection separately so cancelled Google events reopen slots.
// A new editor timestamp replaces the selection; automatic sync never changes it.
export function applyCalendarBusy<T extends CalendarState>(state:T,busy:Busy[],now=new Date(),ok=true):T{
 const selections:Record<string,Selection>={};
 const events=(state.events||[]).map(event=>{
  const a=event.availability;if(!a)return event;
  const previous=state.calendarSelection?.[event.id];
  const selection=previous?.updatedAt===a.updatedAt?previous:{updatedAt:a.updatedAt,days:a.days};
  selections[event.id]=selection;
  const days=Object.fromEntries(Object.keys(selection.days).map(day=>[day,ok?savedSlots({...a,days:selection.days},day,event.duration,busy,now):[]]));
  return {...event,availability:{...a,days}};
 });
 return {...state,events,calendarSelection:selections,calendarSync:{checkedAt:now.toISOString(),ok}};
}
