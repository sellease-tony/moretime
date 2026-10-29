"use client";
import {Plus,Trash2,ArrowUp} from 'lucide-react';
import {MAX_QUESTIONS,newQuestionId,type Question} from '@/lib/bookings/questions';

// Booking-page questions (up to five short or long text answers). Guests answer them on the booking form.
export default function QuestionsEditor({value,onChange}:{value:Question[];onChange:(q:Question[])=>void}){
 const set=(i:number,patch:Partial<Question>)=>onChange(value.map((q,j)=>j===i?{...q,...patch}:q));
 const move=(i:number)=>{const next=[...value];[next[i-1],next[i]]=[next[i],next[i-1]];onChange(next)};
 return <details className="editor-options questions-editor" open={value.length>0}>
  <summary>예약 시 질문 받기 <small>{value.length?`${value.length}개`:'선택'}</small></summary>
  <p className="questions-help">예약자가 예약할 때 답하도록 질문을 추가하세요. 답변은 예약 내역, 내 Google 캘린더 일정, 예약 알림 메일에 함께 표시됩니다.</p>
  {value.map((q,i)=><div className="question-row" key={q.id}>
   <input aria-label={`질문 ${i+1}`} required maxLength={100} value={q.label} onChange={e=>set(i,{label:e.target.value})} placeholder={i===0?'예: 상담받고 싶은 내용을 알려주세요':'질문 내용'}/>
   <select aria-label={`질문 ${i+1} 답변 형식`} value={q.type} onChange={e=>set(i,{type:e.target.value as Question['type']})}><option value="short">짧은 답변</option><option value="long">긴 답변</option></select>
   <label className="question-required"><input type="checkbox" checked={q.required} onChange={e=>set(i,{required:e.target.checked})}/>필수</label>
   <button type="button" aria-label={`질문 ${i+1} 위로`} disabled={i===0} onClick={()=>move(i)}><ArrowUp size={15}/></button>
   <button type="button" aria-label={`질문 ${i+1} 삭제`} onClick={()=>onChange(value.filter((_,j)=>j!==i))}><Trash2 size={15}/></button>
  </div>)}
  {value.length<MAX_QUESTIONS&&<button type="button" className="question-add" onClick={()=>onChange([...value,{id:newQuestionId(),label:'',type:'short',required:false}])}><Plus size={15}/>질문 추가</button>}
 </details>;
}
