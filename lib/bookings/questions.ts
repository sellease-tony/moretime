import {z} from 'zod';

// Questions a host adds to a booking page; guests answer them when they book. Answers keep a copy of the
// question label so editing or deleting a question later never changes what an existing booking shows.
export const MAX_QUESTIONS=5;
export const ANSWER_LIMIT={short:200,long:1000} as const;
export const questionSchema=z.object({
 id:z.string().regex(/^q[a-z0-9]{1,16}$/),
 label:z.string().trim().min(1,'질문 내용을 입력해 주세요.').max(100,'질문은 100자 이내로 입력해 주세요.'),
 type:z.enum(['short','long']),
 required:z.boolean(),
}).strict();
export const questionsSchema=z.array(questionSchema).max(MAX_QUESTIONS,`질문은 최대 ${MAX_QUESTIONS}개까지 추가할 수 있습니다.`)
 .refine(q=>new Set(q.map(x=>x.id)).size===q.length,'질문 ID가 중복되었습니다.');
export const answerSchema=z.object({id:z.string().regex(/^q[a-z0-9]{1,16}$/),label:z.string().max(100),value:z.string().max(ANSWER_LIMIT.long)}).strict();
export const answersSchema=z.array(answerSchema).max(MAX_QUESTIONS);
export type Question=z.infer<typeof questionSchema>;
export type Answer=z.infer<typeof answerSchema>;

export const newQuestionId=()=>'q'+Math.random().toString(36).slice(2,10);

// Control characters are dropped (line breaks survive only in long answers) so answers stay safe in emails and calendar text.
const clean=(v:string,long:boolean)=>(long?v.replace(/\r\n?/g,'\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g,''):v.replace(/[\u0000-\u001f\u007f]/g,' ')).trim();

// Turns the guest's raw {questionId: text} into stored answers, enforcing required questions and lengths.
export function collectAnswers(questions:Question[]|undefined,raw:unknown):Answer[]{
 const input=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw as Record<string,unknown>:{};
 const out:Answer[]=[];
 for(const q of questions||[]){
  const value=clean(typeof input[q.id]==='string'?input[q.id] as string:'',q.type==='long');
  if(q.required&&!value)throw new Error(`'${q.label}' 항목에 답해 주세요.`);
  if(value.length>ANSWER_LIMIT[q.type])throw new Error(`'${q.label}' 답변은 ${ANSWER_LIMIT[q.type]}자 이내로 입력해 주세요.`);
  if(value)out.push({id:q.id,label:q.label,value});
 }
 return out;
}

// Plain-text block for calendar descriptions and emails.
export function answersText(answers:Answer[]|undefined){
 return (answers||[]).map(a=>`${a.label}\n${a.value}`).join('\n\n');
}
