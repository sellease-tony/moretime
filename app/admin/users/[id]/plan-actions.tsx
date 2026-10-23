"use client";
import {useActionState} from 'react';
import {grantPro,extendTrial,setFree,type ActionState} from '../../actions';
import s from '../../admin.module.css';

function Result({state}:{state:ActionState}){return state?<p className={state.ok?s.resultOk:s.resultErr} role="status">{state.message}</p>:null}

// Manual plan changes; every submission is re-authorized on the server and written to the audit log.
export default function PlanActions({ownerId}:{ownerId:string}){
 const [g,grant,gp]=useActionState(grantPro,null),[t,trial,tp]=useActionState(extendTrial,null),[f,free,fp]=useActionState(setFree,null);
 return <div className={s.actions}>
  <form action={grant} onSubmit={e=>{if(!confirm('이 회원에게 프로 플랜을 부여할까요?'))e.preventDefault()}}><b>프로 수동 부여</b><input type="hidden" name="ownerId" value={ownerId}/>
   <label>종료일 (비우면 무기한)<input type="date" name="until"/></label>
   <label>메모<input name="note" maxLength={500} placeholder="예: 파트너 제공"/></label>
   <button className={s.btnPrimary} disabled={gp}>{gp?'저장 중…':'부여'}</button><Result state={g}/></form>
  <form action={trial} onSubmit={e=>{if(!confirm('이 회원의 무료 체험을 연장할까요?'))e.preventDefault()}}><b>무료 체험 연장</b><input type="hidden" name="ownerId" value={ownerId}/>
   <label>연장 일수<input type="number" name="days" min={1} max={90} defaultValue={14} required/></label>
   <label>메모<input name="note" maxLength={500}/></label>
   <button className={s.btn} disabled={tp}>{tp?'저장 중…':'연장'}</button><Result state={t}/></form>
  <form action={free} onSubmit={e=>{if(!confirm('이 회원을 무료 플랜으로 바꿀까요?'))e.preventDefault()}}><b>무료 플랜으로 변경</b><input type="hidden" name="ownerId" value={ownerId}/>
   <label>메모<input name="note" maxLength={500}/></label>
   <button className={s.btnDanger} disabled={fp}>{fp?'저장 중…':'무료로 변경'}</button><Result state={f}/></form>
 </div>;
}
