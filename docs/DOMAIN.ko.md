# 도메인 전환: moretime.co.kr

기존 주소 `moretime-pearl.vercel.app`에서 `moretime.co.kr`로 옮기는 순서입니다. 코드는 `APP_URL`만 바꾸면 따라가도록 되어 있습니다(`lib/site.ts`).

## 1. 도메인과 Vercel
1. `moretime.co.kr`을 구매합니다.
2. Vercel → Project → Settings → Domains에 `moretime.co.kr`과 `www.moretime.co.kr`을 추가하고, `www`는 apex로 리디렉션하도록 설정합니다.
3. 도메인 업체 DNS에 Vercel이 안내하는 레코드를 등록합니다(보통 apex `A 76.76.21.21`, `www` `CNAME cname.vercel-dns.com`). HTTPS 인증서가 발급될 때까지 기다립니다.

## 2. 외부 서비스 설정 (APP_URL 변경 전)
- **Supabase** → Authentication → URL Configuration
  - Site URL: `https://moretime.co.kr`
  - Redirect URLs에 추가: `https://moretime.co.kr/auth/callback`, `https://moretime.co.kr/auth/callback?next=*`
  - 전환 기간 동안 기존 `moretime-pearl.vercel.app` 항목은 지우지 않습니다.
- **Google Cloud** → OAuth 동의 화면
  - 승인된 도메인: `moretime.co.kr`
  - 앱 홈페이지 `https://moretime.co.kr`, 개인정보처리방침 `https://moretime.co.kr/privacy`, 서비스 약관 `https://moretime.co.kr/terms`
  - Search Console에서 도메인 소유권을 인증해 두면 앱 검수에 필요합니다.
- **Resend** → Domains에 `moretime.co.kr`(또는 `mail.moretime.co.kr`) 추가 후 SPF·DKIM 레코드 등록, 인증 완료 확인

## 3. 전환
1. Vercel 환경변수 `APP_URL=https://moretime.co.kr`, 필요하면 `EMAIL_FROM="모아타임 <booking@moretime.co.kr>"`로 바꾸고 재배포합니다.
2. 재배포 후 옛 주소의 화면 접속은 새 도메인으로 308 리디렉션됩니다. `/api/*`는 리디렉션하지 않아 기존 cron·webhook이 끊기지 않습니다.
3. Supabase pg_cron 두 작업의 URL을 새 도메인으로 바꿉니다([스케줄러 가이드](SCHEDULER.ko.md)의 `cron.unschedule` 후 재등록).
4. 주최자는 새 도메인에서 한 번 다시 로그인해야 합니다(로그인 쿠키는 도메인별로 저장).
5. Google 캘린더 변경 알림 채널은 갱신 시 새 `APP_URL`로 다시 등록되므로 따로 작업하지 않습니다.

## 4. 확인
- `https://moretime-pearl.vercel.app/book/<id>` → `https://moretime.co.kr/book/<id>`로 이동
- 새 도메인에서 Google 로그인 → `/app` 진입
- 테스트 예약 확정 메일의 발신 주소와 관리 링크 도메인
- `cron.job_run_details`, `net._http_response`에서 새 URL 호출이 200인지

## 게시 전 확인
`lib/legal.ts`의 `확인 필요` 항목(대표자, 사업자등록번호, 주소, 개인정보 보호책임자, 연락처, 시행일, 예약 정보 보관 기간)을 채우고 법률 검토를 받은 뒤 `/privacy`, `/terms`를 공개합니다.
