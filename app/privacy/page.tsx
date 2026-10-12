import type {Metadata} from 'next';
import LegalDoc,{V,legalStyles as s} from '@/components/legal-doc';
export const metadata:Metadata={title:'개인정보 처리방침 · 모아타임',alternates:{canonical:'/privacy'}};
export default function Privacy(){
 return <LegalDoc title="개인정보 처리방침">
  <p><V k="operator"/>(이하 &lsquo;회사&rsquo;)는 모아타임 서비스(이하 &lsquo;서비스&rsquo;)를 제공하면서 「개인정보 보호법」에 따라 이용자의 개인정보를 보호하고, 관련 고충을 신속하게 처리하기 위해 다음과 같이 개인정보 처리방침을 둡니다.</p>

  <h2>1. 처리하는 개인정보 항목과 수집 방법</h2>
  <div className={s.tableWrap}><table><thead><tr><th>구분</th><th>항목</th><th>수집 방법</th></tr></thead><tbody>
   <tr><td>주최자(회원)</td><td>Google 계정 이름, 이메일 주소, 프로필 식별자, Google 캘린더 접근 권한 토큰(암호화 저장)</td><td>Google 로그인</td></tr>
   <tr><td>주최자 캘린더</td><td>표시 중인 캘린더의 바쁜 시간 구간(시작·종료 시각), 캘린더 목록. 일정 제목·내용·참석자는 수집하지 않습니다.</td><td>Google Calendar API</td></tr>
   <tr><td>예약자</td><td>이름, 이메일 주소, 휴대전화 번호, 회사명(주최자가 요청한 경우), 예약 일시</td><td>예약 화면 입력</td></tr>
   <tr><td>투표 참석자</td><td>이름, 이메일 주소, 가능한 시간 선택</td><td>투표 화면 입력</td></tr>
   <tr><td>자동 수집</td><td>접속 IP(요청 제한용 해시값), 서비스 이용 기록, 쿠키(로그인 세션)</td><td>서비스 이용 과정</td></tr>
  </tbody></table></div>

  <h2>2. 개인정보의 처리 목적</h2>
  <ul><li>주최자 로그인과 본인 확인, 예약 페이지 운영</li><li>주최자의 바쁜 시간을 제외한 예약 가능 시간 계산, 확정된 예약의 주최자 캘린더 등록·삭제</li><li>예약 확정·취소·변경 및 리마인더 이메일 발송, 예약자의 예약 변경·취소 링크 제공</li><li>중복 예약과 서비스 남용 방지, 오류 대응</li></ul>

  <h2>3. 보유 및 이용 기간</h2>
  <ul><li>주최자 정보: 회원 탈퇴 시까지. 탈퇴 시 지체 없이 파기합니다.</li><li>예약·투표 정보: 미팅 종료 후 <V k="bookingRetention"/>까지 보관한 뒤 파기합니다.</li><li>요청 제한용 IP 해시값: 최대 1일</li><li>관계 법령에 따라 보존할 의무가 있는 경우 해당 기간 동안 보관합니다.</li></ul>

  <h2>4. 개인정보의 제3자 제공</h2>
  <p>회사는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만 예약자가 입력한 이름·이메일·연락처·회사명은 예약 처리를 위해 해당 예약 페이지의 주최자에게 표시되며, 주최자의 Google 캘린더 일정에 기록됩니다.</p>

  <h2>5. 개인정보 처리의 위탁 및 국외 이전</h2>
  <p>회사는 서비스 제공을 위해 다음과 같이 개인정보 처리를 위탁하며, 일부 수탁자는 국외에서 개인정보를 처리합니다.</p>
  <div className={s.tableWrap}><table><thead><tr><th>수탁자</th><th>위탁 업무</th><th>이전 국가·방법</th><th>이전 항목</th></tr></thead><tbody>
   <tr><td>Supabase, Inc.</td><td>데이터베이스·로그인 인증 운영</td><td>데이터 저장: 대한민국(서울 리전). 운영·지원 과정에서 미국 등에서 접근 가능 · 네트워크 전송</td><td>1항의 모든 항목</td></tr>
   <tr><td>Vercel, Inc.</td><td>웹 서비스 호스팅</td><td>미국 등 · 네트워크 전송</td><td>서비스 이용 기록, 접속 정보</td></tr>
   <tr><td>Resend</td><td>이메일 발송</td><td>미국 · 네트워크 전송</td><td>수신자 이름·이메일, 예약 일시·미팅명</td></tr>
   <tr><td>Google LLC</td><td>로그인, 캘린더 연동</td><td>미국 · 네트워크 전송</td><td>주최자 계정 정보, 확정 예약 정보(주최자 캘린더 등록)</td></tr>
  </tbody></table></div>
  <p>국외 이전을 원하지 않는 이용자는 서비스 이용을 중단할 수 있으나, 이 경우 예약 서비스를 이용할 수 없습니다.</p>

  <h2>6. Google 사용자 데이터 처리</h2>
  <p>서비스가 Google API를 통해 받은 정보의 사용과 다른 앱으로의 전송은 Limited Use 요구사항을 포함한 <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Google API 서비스 사용자 데이터 정책</a>을 준수합니다. 캘린더 정보는 예약 가능 시간 계산과 확정 예약의 캘린더 등록에만 사용하며, 광고에 사용하거나 사람이 열람하지 않습니다. 이용자는 Google 계정 설정에서 언제든 권한을 철회할 수 있습니다.</p>

  <h2>7. 개인정보의 파기</h2>
  <p>보유 기간이 지나거나 처리 목적이 달성된 개인정보는 지체 없이 복구할 수 없는 방법으로 삭제합니다.</p>

  <h2>8. 정보주체의 권리와 행사 방법</h2>
  <p>이용자는 언제든 개인정보의 열람·정정·삭제·처리정지를 요구할 수 있습니다. 예약자는 확인 이메일의 전용 링크로 예약을 직접 변경·취소할 수 있으며, 그 밖의 요청은 아래 연락처로 접수하면 지체 없이 조치합니다.</p>

  <h2>9. 안전성 확보 조치</h2>
  <ul><li>Google 캘린더 접근 토큰은 AES-256-GCM으로 암호화해 저장합니다.</li><li>데이터베이스 행 단위 접근 제어(RLS)와 서버 전용 키로 접근 권한을 제한합니다.</li><li>모든 통신은 HTTPS로 암호화합니다.</li><li>예약 변경 링크는 서명된 토큰으로 보호하며, 링크 주소가 외부로 전달되지 않도록 처리합니다.</li></ul>

  <h2>10. 쿠키 등의 사용</h2>
  <p>서비스는 로그인 상태 유지를 위해 세션 쿠키를 사용하며, 투표 응답 수정을 위해 브라우저 저장소에 응답 정보를 보관할 수 있습니다. 브라우저 설정에서 쿠키를 거부할 수 있으나 로그인이 필요한 기능을 이용할 수 없습니다.</p>

  <h2>11. 개인정보 보호책임자</h2>
  <ul><li>책임자: <V k="privacyOfficer"/></li><li>전화: <V k="phone"/></li><li>서비스 문의: <V k="contactEmail"/></li></ul>
  <p>개인정보 침해에 관한 신고나 상담은 개인정보침해신고센터(privacy.kisa.or.kr, 국번 없이 118) 등에 문의할 수 있습니다.</p>

  <h2>12. 처리방침의 변경</h2>
  <p>이 처리방침은 <V k="effectiveDate"/>부터 적용되며, 내용이 바뀌는 경우 서비스 화면을 통해 알립니다.</p>
 </LegalDoc>;
}
