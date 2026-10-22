// Plans shown on the landing page; the same limits will drive enforcement and billing once paid plans open.
// Prices include VAT (부가가치세 포함), as Korean consumer pricing must.
export type PlanId='free'|'pro';
export type Plan={
 id:PlanId;name:string;tagline:string;
 monthly:number;           // KRW per month, monthly billing
 yearlyPerMonth:number;    // KRW per month when billed yearly
 limits:{activePages:number|null;openPolls:number|null}; // null = unlimited
 features:string[];
};
export const PRO_TRIAL_DAYS=14;
export const plans:Plan[]=[
 {id:'free',name:'무료',tagline:'혼자 가볍게 시작할 때',monthly:0,yearlyPerMonth:0,limits:{activePages:1,openPolls:1},features:[
  '활성 예약 페이지 1개',
  '진행 중인 여러 명 일정 투표 1개',
  '예약 횟수 무제한',
  'Google 캘린더 바쁜 시간 자동 제외',
  '확정 예약 내 캘린더 자동 등록 · Google Meet 링크',
  '예약 확정·변경·취소 이메일 알림',
  '예약자 셀프 변경·취소 링크',
 ]},
 {id:'pro',name:'프로',tagline:'미팅이 일상인 개인·프리랜서',monthly:5000,yearlyPerMonth:4000,limits:{activePages:null,openPolls:null},features:[
  '무료 플랜의 모든 기능',
  '예약 페이지 · 일정 투표 무제한',
  '하루 전 · 1시간 전 리마인더 이메일',
  '예약 규칙: 최소 예약 시간, 하루 최대 예약 수',
  '오프라인 미팅 앞뒤 이동 시간 자동 확보',
  '예약 페이지의 모아타임 표시 제거',
  '우선 고객 지원',
 ]},
];
export const won=(n:number)=>n.toLocaleString('ko-KR')+'원';
export const yearlyTotal=(p:Plan)=>p.yearlyPerMonth*12;
