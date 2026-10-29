"use client";
import {useEffect,useState} from 'react';
import {handleError} from '@/lib/handles';

// "내 예약 주소": moretime.sellease.io/{handle}. Booking pages with a page address get /{handle}/{slug} links.
export default function HandleSettings(){
 const [saved,setSaved]=useState<string|null>(null),[value,setValue]=useState(''),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState<{ok:boolean;text:string}|null>(null);
 useEffect(()=>{fetch('/api/profile',{cache:'no-store'}).then(r=>r.json()).then(d=>{setSaved(d.handle||null);setValue(d.handle||'')}).catch(()=>{}).finally(()=>setLoading(false))},[]);
 const host='moretime.sellease.io'; // fixed so server and browser render the same text
 const local=value&&handleError(value);
 async function save(){
  setSaving(true);setMessage(null);
  try{const r=await fetch('/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({handle:value})});const d=await r.json();if(!r.ok)throw Error(d.error);setSaved(d.handle);setValue(d.handle);setMessage({ok:true,text:'저장했습니다. 예약 페이지마다 페이지 주소를 정하면 짧은 링크로 공유됩니다.'})}
  catch(e){setMessage({ok:false,text:e instanceof Error?e.message:'저장하지 못했습니다.'})}finally{setSaving(false)}
 }
 return <section className="panel settings-card"><h2>내 예약 주소</h2>
  <p className="settings-help">기억하기 쉬운 주소로 예약 링크를 공유하세요. 예: {host}/tony/coffee</p>
  <form className="handle-form" onSubmit={e=>{e.preventDefault();if(!local&&value&&value!==saved)void save()}}>
   <label><span>{host}/</span><input aria-label="내 예약 주소" value={value} disabled={loading||saving} maxLength={30} placeholder="my-name" onChange={e=>{setValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''));setMessage(null)}}/></label>
   <button className="secondary-button" disabled={loading||saving||!value||!!local||value===saved}>{saving?'저장 중…':'저장'}</button>
  </form>
  {local&&<p className="settings-message" role="alert">{local}</p>}
  {message&&<p className="settings-message" role="status" style={message.ok?undefined:{color:'#b03a3a'}}>{message.text}</p>}
  {saved&&<p className="settings-help">내 프로필: <a href={`/${saved}`} target="_blank" rel="noopener" style={{color:'var(--primary)',fontWeight:600}}>{host}/{saved}</a> · 주소를 바꾸면 이전 주소로 보낸 링크는 더 이상 열리지 않습니다.</p>}
 </section>;
}
