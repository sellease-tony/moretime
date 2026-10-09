// "Add to calendar" links for a confirmed booking. Booking times are KST wall-clock values.
type Meeting={id:string;title:string;day:string;time:string;duration:number;details?:string};
const stamp=(d:Date)=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
export function meetingRange(m:Pick<Meeting,'day'|'time'|'duration'>){const start=new Date(`${m.day}T${m.time}:00+09:00`);return {start,end:new Date(start.getTime()+m.duration*60000)}}
export function googleCalendarUrl(m:Meeting){
 const {start,end}=meetingRange(m);
 const q=new URLSearchParams({action:'TEMPLATE',text:m.title,dates:`${stamp(start)}/${stamp(end)}`,ctz:'Asia/Seoul'});
 if(m.details)q.set('details',m.details);
 return 'https://calendar.google.com/calendar/render?'+q.toString();
}
const escapeText=(s:string)=>s.replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');
// RFC 5545 requires CRLF line endings; the UID keeps re-downloads from duplicating the event.
export function icsContent(m:Meeting,now=new Date()){
 const {start,end}=meetingRange(m);
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//moatime//booking//KO','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',`UID:${m.id}@moatime`,`DTSTAMP:${stamp(now)}`,`DTSTART:${stamp(start)}`,`DTEND:${stamp(end)}`,`SUMMARY:${escapeText(m.title)}`,...(m.details?[`DESCRIPTION:${escapeText(m.details)}`]:[]),'END:VEVENT','END:VCALENDAR'];
 return lines.join('\r\n')+'\r\n';
}
