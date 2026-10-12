# 도메인 전환: moretime.sellease.io

기존 주소 `moretime-pearl.vercel.app`에서 회사 도메인의 하위 주소 `moretime.sellease.io`로 옮기는 순서입니다. 코드는 `APP_URL`만 바꾸면 따라가도록 되어 있습니다(`lib/site.ts`).

## 1. Vercel과 DNS
1. Vercel → Project → Settings → Domains에 `moretime.sellease.io`를 추가합니다. Vercel이 보여주는 CNAME 값을 확인합니다(보통 `cname.vercel-dns.com`).
2. `sellease.io` DNS는 **AWS Route 53**에 있습니다. 호스팅 영역 `sellease.io`에 레코드를 추가합니다.
   - 이름 `moretime`, 유형 `CNAME`, 값은 1단계에서 Vercel이 안내한 값, TTL `300`
   - `*.sellease.io` 와일드카드 레코드는 그대로 둡니다. 구체적인 `moretime` 레코드가 우선합니다.
   - Vercel이 `_vercel` TXT 인증을 요구하면 같은 방법으로 추가합니다.
3. Vercel Domains 화면에 Valid Configuration이 뜨고 HTTPS 인증서가 발급될 때까지 기다립니다.

## 2. 외부 서비스 설정 (APP_URL 변경 전)
- **Supabase** → Authentication → URL Configuration
  - Site URL: `https://moretime.sellease.io`
  - Redirect URLs에 추가: `https://moretime.sellease.io/auth/callback`, `https://moretime.sellease.io/auth/callback?next=*`
  - 전환 기간 동안 기존 `moretime-pearl.vercel.app` 항목은 지우지 않습니다.
- **Google Cloud** → OAuth 동의 화면
  - 승인된 도메인에 `sellease.io`가 있는지 확인합니다(하위 주소는 따로 추가하지 않아도 됩니다).
  - 앱 홈페이지 `https://moretime.sellease.io`, 개인정보처리방침 `https://moretime.sellease.io/privacy`, 서비스 약관 `https://moretime.sellease.io/terms`
- **Resend**: 이미 `sellease.io`로 발송 중이므로 바꿀 것이 없습니다. 받는 사람에게 서비스명이 보이도록 `EMAIL_FROM`의 표시 이름을 `모아타임 <…@sellease.io>`로 두는 것을 권합니다.

## 3. 전환
1. Vercel 환경변수 `APP_URL=https://moretime.sellease.io`로 바꾸고 재배포합니다.
2. 재배포 후 옛 주소의 화면 접속은 새 주소로 308 리디렉션됩니다. `/api/*`는 리디렉션하지 않아 기존 cron·webhook이 끊기지 않습니다.
3. Supabase pg_cron 두 작업의 URL을 새 주소로 바꿉니다([스케줄러 가이드](SCHEDULER.ko.md)의 `cron.unschedule` 후 재등록).
4. 주최자는 새 주소에서 한 번 다시 로그인해야 합니다(로그인 쿠키는 주소별로 저장).
5. Google 캘린더 변경 알림 채널은 갱신 시 새 `APP_URL`로 다시 등록되므로 따로 작업하지 않습니다.

## 4. 확인
- `https://moretime-pearl.vercel.app/book/<id>` → `https://moretime.sellease.io/book/<id>`로 이동
- 새 주소에서 Google 로그인 → `/app` 진입
- 테스트 예약 확정 메일의 관리 링크가 새 주소인지
- `cron.job_run_details`, `net._http_response`에서 새 URL 호출이 200인지

## 판매 전 확인
`lib/legal.ts`의 `확인 필요` 항목(대표자, 사업자등록번호, 통신판매업 신고번호, 주소, 고객센터 전화, 이메일, 개인정보 보호책임자, 시행일, 예약 정보 보관 기간)을 채웁니다. 랜딩 하단과 `/privacy`, `/terms`의 사업자 정보에 그대로 표시됩니다. 유료 판매 전에는 이용약관에 요금·결제·환불 조항을 추가하고 법률 검토를 받습니다.
