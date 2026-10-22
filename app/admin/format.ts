// Display helpers for the back office (Korea time).
export const fmtDate=(iso:string|null|undefined)=>iso?new Date(iso).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',year:'2-digit',month:'2-digit',day:'2-digit'}):'—';
export const fmtDateTime=(iso:string|null|undefined)=>iso?new Date(iso).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
export const actionLabel:Record<string,string>={grant_pro:'프로 수동 부여',extend_trial:'체험 연장',set_free:'무료로 변경'};
