import {z} from 'zod';
export const companySchema=z.string().trim().max(80,'회사명은 80자 이내로 입력해 주세요.').refine(v=>!/[\r\n\u0000-\u001f]/.test(v),'회사명에 줄바꿈은 사용할 수 없습니다.');
export const companyModeSchema=z.enum(['hidden','optional','required']);
export const meetingTemplateSchema=z.string().trim().max(100).refine(v=>!/[\r\n\u0000-\u001f]/.test(v),'제목은 한 줄로 입력해 주세요.').refine(v=>!/[{}]/.test(v.replaceAll('{회사명}','').replaceAll('{페이지명}','')),'{회사명}, {페이지명}만 사용할 수 있습니다.');
export type MeetingSettings={title:string;companyMode?:'hidden'|'optional'|'required';meetingTitleTemplate?:string};
export function meetingFields(event:MeetingSettings,input:unknown){
 const company=event.companyMode&&event.companyMode!=='hidden'?companySchema.parse(input??''):'';
 if(event.companyMode==='required'&&!company)throw Error('회사명을 입력해 주세요.');
 const meetingTitle=company?(event.meetingTitleTemplate||'{회사명} × {페이지명}').replace(/\{회사명\}|\{페이지명\}/g,key=>key==='{회사명}'?company:event.title):event.title;
 return {company,meetingTitle};
}
export function displayMeeting(b:{title:string;meetingTitle?:string}){return b.meetingTitle||b.title}
