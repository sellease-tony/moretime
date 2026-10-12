// Operator and seller details. The landing footer and the legal pages render them; values marked TODO must be
// confirmed (and the documents reviewed) before selling. Online sellers in Korea must show the business
// identity fields below (전자상거래법 제10조, 제13조).
export const TODO='확인 필요';
export const legal={
 service:'모아타임 (moretime.sellease.io)',
 // From Sellease's own quotation (supplier block) and its personal-data internal management plan.
 operator:'(주)셀리즈',
 representative:'유민재',
 businessNumber:'381-86-03180',
 // 통신판매업 신고번호 — required once paid plans are sold online.
 mailOrderNumber:TODO,
 address:'서울시 관악구 낙성대로 2, 낙성벤처창업센터 2층',
 phone:'070-8080-5994',
 contactEmail:'help@sellease.io',
 privacyOfficer:'대표이사 유민재 (manager@sellease.us)',
 hosting:'Vercel Inc.',
 effectiveDate:TODO,
 // How long booking records are kept after the meeting ends.
 bookingRetention:TODO,
};
export const legalComplete=()=>Object.values(legal).every(v=>v!==TODO);
// Business identity rows for the site footer, in the order Korean storefronts usually show them.
export const businessRows:[string,keyof typeof legal][]=[
 ['상호','operator'],['대표자','representative'],['사업자등록번호','businessNumber'],['통신판매업 신고번호','mailOrderNumber'],
 ['주소','address'],['고객센터','phone'],['이메일','contactEmail'],['개인정보 보호책임자','privacyOfficer'],['호스팅 서비스','hosting'],
];
