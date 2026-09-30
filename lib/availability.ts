import {overlaps,type Busy} from './calendar/google';
export type Availability={days:Record<string,string[]>;source:'manual'|'google';updatedAt:string;importedAt?:string;includeWeekends?:boolean;includeLunch?:boolean;meetingMode?:'online'|'offline';excludeHolidays?:boolean};
export function kstDay(now=new Date()){return new Date(now.getTime()+9*3600000).toISOString().slice(0,10)}
export function addDays(day:string,n:number){return new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10)}
export function savedSlots(availability:Availability|undefined,day:string,duration:number,busy:Busy[],now=new Date()){
  return [...new Set(availability?.days[day]||[])].filter(time=>{
    const start=new Date(`${day}T${time}:00+09:00`),end=new Date(start.getTime()+duration*60000);
    return (Number(time.slice(0,2))*60+Number(time.slice(3)))%duration===0&&permitsTime(availability,day,time,duration)&&start>now&&!overlaps(start.toISOString(),end.toISOString(),busy,availability?.meetingMode==='offline'?60:0);
  }).sort();
}
export function monthSlots(availability:Availability|undefined,month:string,duration:number,busy:Busy[],now=new Date()){
  return Object.fromEntries(Object.keys(availability?.days||{}).filter(day=>day.startsWith(month+'-')).sort().map(day=>[day,savedSlots(availability,day,duration,busy,now)]));
}

// Undefined options preserve existing pages; new pages explicitly choose their defaults.
export function permitsTime(options:{includeWeekends?:boolean;includeLunch?:boolean}|undefined,day:string,time:string,duration:number){
 const weekday=new Date(day+'T12:00:00+09:00').getUTCDay();
 if(options?.includeWeekends===false&&(weekday===0||weekday===6))return false;
 const minute=Number(time.slice(0,2))*60+Number(time.slice(3));
 return options?.includeLunch!==false||!(minute<13*60&&minute+duration>12*60);
}
