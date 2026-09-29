export type ReminderSettings={reminder_24h:boolean;reminder_1h:boolean;guest:boolean;host:boolean};
export const defaultReminders:ReminderSettings={reminder_24h:true,reminder_1h:true,guest:true,host:true};
export function isReminder(type:string){return type==='reminder_24h'||type==='reminder_1h'}
export function reminderCanSend(job:{event_type:string;recipient_role?:string;expires_at:string},booking:{status:string;starts_at:string},settings:ReminderSettings,now=Date.now()){
 return booking.status==='confirmed'&&Date.parse(booking.starts_at)>now&&Date.parse(job.expires_at)>now&&
 (job.event_type==='reminder_24h'?settings.reminder_24h:settings.reminder_1h)&&
 (job.recipient_role==='host'?settings.host:settings.guest);
}
