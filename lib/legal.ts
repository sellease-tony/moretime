// Operator details shown on the privacy policy and terms. Values marked TODO must be confirmed
// (and the documents reviewed) before these pages are linked from production.
export const TODO='확인 필요';
export const legal={
 service:'모아타임 (moretime.co.kr)',
 operator:'(주)셀리즈',
 representative:TODO,
 businessNumber:TODO,
 address:TODO,
 privacyOfficer:TODO,
 contactEmail:TODO,
 effectiveDate:TODO,
 // How long booking records are kept after the meeting ends.
 bookingRetention:TODO,
};
export const legalComplete=()=>Object.values(legal).every(v=>v!==TODO);
