"use client";
import NotificationSettings from '@/components/notification-settings';
import type {HostUser,Workspace} from './use-workspace';
const DAYS=['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];

export function HoursView({ws,onSave}:{ws:Workspace;onSave:()=>void}){
 const {hours,setHours,range,setRange,busy}=ws;
 return <section className="panel"><h2>주간 가능 시간 템플릿</h2><p>예약 페이지에서 기간을 채울 때 사용하는 기본값입니다. 페이지별 날짜·시간은 예약 페이지 카드에서 설정하세요.</p><p>서울 · Asia/Seoul (UTC+09:00)</p>{DAYS.map((d,i)=><div className="hoursrow" key={d}><label><input type="checkbox" checked={hours[i]} onChange={e=>setHours(hours.map((v,j)=>j===i?e.target.checked:v))}/>{d}</label>{hours[i]?<><input aria-label={d+' 시작'} type="time" value={range[0]} onChange={e=>setRange([e.target.value,range[1]])}/><span>—</span><input aria-label={d+' 종료'} type="time" value={range[1]} onChange={e=>setRange([range[0],e.target.value])}/></>:<span className="muted">예약 불가</span>}</div>)}<p>선택한 모든 요일에 동일한 시간이 적용됩니다.</p><button className="primary" disabled={busy} onClick={()=>range[0]<range[1]?onSave():ws.notify('종료 시간을 시작 시간 이후로 설정해 주세요.')}>변경사항 저장</button></section>;
}

export function SettingsView({user}:{user:HostUser}){
 return <><section className="panel"><h2>Google 계정 및 캘린더</h2><div className="integration"><span className="google">G</span><div><h3>{user?.email||'Google 계정 연결'}</h3><p>표시 중인 Google 캘린더의 바쁜 시간을 제외합니다.</p></div><a className="primary" href="/auth/google">{user?'다시 연결':'Google로 연결'}</a></div><div className="notice">개인·기업 모두 Google 로그인만 제공합니다. Google 가져오기는 가능 시간 설정에서 실행합니다. 예약 화면은 저장된 시간만 조회합니다.</div></section><NotificationSettings/></>;
}
