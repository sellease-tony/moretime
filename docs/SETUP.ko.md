# 연결 가이드: Supabase · Vercel · Google 캘린더 · 알림

## 현재 DB와 전환 구조

기존 `chatgpt.site` 검토본은 **Cloudflare Workers + D1(SQLite)**입니다. `workspaces` 테이블에 데모 브라우저별 예약 JSON을 저장했습니다.

이번 버전은 **Next.js → Vercel Functions → Supabase PostgreSQL**입니다. 프론트엔드뿐 아니라 예약 API와 알림 API도 Vercel에서 실행됩니다.

GitHub: https://github.com/sellease-tony/moretime

코드·SQL·환경변수 예제·모의 테스트를 준비했습니다. 실제 Supabase 프로젝트 적용, Vercel 배포, Google 로그인 및 메시지 수신 검증은 외부 서비스 설정 후 진행해야 합니다. 기존 검토 사이트는 자동 변경되지 않습니다.

## 1. Supabase

1. 프로젝트를 생성하고 SQL Editor에서 아래 파일을 순서대로 **한 번씩** 실행합니다.
   - `supabase/migrations/202609200001_moatime.sql`
   - `supabase/migrations/202609200002_calendar_links.sql`
   - `supabase/migrations/202609230001_saved_availability.sql`
2. Project URL, Publishable key, Secret key를 확인합니다.
3. URL/Publishable key만 `NEXT_PUBLIC_*` 변수에 사용합니다. Secret key 또는 기존 `service_role` key는 `SUPABASE_SECRET_KEY`에만 넣습니다.

| 테이블 | 용도 |
|---|---|
| `moa_workspaces` | Google 사용자별 예약 페이지·가능 시간·수정 버전 |
| `moa_bookings` | 예약자 정보·시작/종료·확정/취소 상태 |
| `moa_notification_jobs` | 채널·수신자별 발송 대기 기록과 결과 |
| `moa_google_connections` | 서버에서 암호화한 Google refresh token |
| `moa_public_links` | 공개 링크와 주최자·예약 페이지 연결 |

RLS는 사용자 자신의 데이터만 조회하도록 제한합니다. 쓰기는 Google 사용자를 검증한 서버 API에서만 가능하며, Google 토큰은 브라우저 조회를 허용하지 않습니다.

기존 D1 기록은 자동 복사하지 않습니다. 데모 쿠키에는 Google 사용자 정보가 없으므로 보존하려면 별도 내보내기와 소유자 매핑이 필요합니다. 이번 작업에서는 기존 D1 데이터를 삭제하지 않았습니다.

## 2. Google 로그인·캘린더

1. Google Cloud에서 **Google Calendar API**를 활성화합니다.
2. OAuth 동의 화면과 웹 애플리케이션용 OAuth 클라이언트를 만듭니다.
3. Google의 승인된 리디렉션 URI에는 Supabase Google Provider 화면의 callback URL을 등록합니다. 일반 형식은 `https://<project-ref>.supabase.co/auth/v1/callback`입니다.
4. Supabase → Authentication → Providers → Google에 Client ID/Secret을 입력합니다. **Email·Phone·기타 공급자는 끄고 Google만 활성화**합니다.
5. Supabase URL Configuration: Site URL은 최종 서비스 주소. Redirect URLs에는 `https://<서비스도메인>/auth/callback`과 공개 예약 복귀 쿼리용 `https://<서비스도메인>/auth/callback?next=*`를 등록합니다. 개발용 `http://localhost:3000`도 같은 형식으로 별도 등록합니다.
6. 동일 Google OAuth Client ID/Secret을 Vercel의 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`에도 설정합니다. Calendar access token 갱신에 사용합니다.
7. 아래 명령으로 암호화 키를 생성해 `CALENDAR_TOKEN_ENCRYPTION_KEY`에 저장합니다.

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

키는 비밀값이므로 GitHub에 넣지 않습니다. 운영 중 키를 변경하면 저장 토큰을 복호화할 수 없어 Google 재연결이 필요합니다.

로그인 요청에는 offline access와 다음 권한이 포함됩니다.

```text
https://www.googleapis.com/auth/calendar.events.freebusy
https://www.googleapis.com/auth/calendar.calendarlist.readonly
https://www.googleapis.com/auth/calendar.events.owned
```

기본 캘린더 및 표시하도록 선택한 캘린더의 바쁜 시간을 제외합니다. 숨긴 캘린더는 제외합니다. 반복/종일 일정은 Google FreeBusy 결과를 따르며, ‘한가함’으로 설정한 이벤트는 예약을 막지 않습니다. 일정 제목·내용은 가져와 예약자에게 공개하지 않습니다.

Google 가져오기에 실패하면 기존 가능 시간 선택을 유지합니다. 게스트 조회·확정은 Google 조회 없이 저장된 가능 시간과 DB 예약 충돌로 검증합니다. Google 테스트 앱의 사용자 제한·토큰 만료 및 공개 서비스의 권한 검증 필요 여부를 확인하세요. [Supabase Google 설정](https://supabase.com/docs/guides/auth/social-login/auth-google), [Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [FreeBusy API](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query)

예약 가능 시간은 주최자가 페이지별로 선택하거나 Google에서 가져온 뒤 moa_workspaces.data.events[].availability에 저장합니다. 예약자는 기본 Google 신원 확인만 하며 캘린더 권한을 요청하지 않습니다. 확정 예약은 주최자의 기본 Google 캘린더에 생성하고 취소 시 삭제합니다. 기존 주최자는 설정 및 연동 → Google 캘린더 다시 연결에서 쓰기 권한에 동의해야 합니다. 실패 시 DB 예약은 유지되며 설정의 예약·취소 캘린더 반영 재시도로 복구합니다. 예약 ID 기반 이벤트 ID로 중복 생성을 막습니다. 자동 재시도 스케줄러는 없으며 기존 예약도 재시도 버튼으로 반영합니다. Google에서 직접 변경한 일정은 주최자가 기간을 다시 가져와 저장해야 반영됩니다. 서비스 내부 중복 예약은 DB 잠금으로 막습니다.

## 3. 이메일: Resend

1. Resend에서 발신 도메인을 추가하고 안내된 DNS 레코드를 등록·인증합니다.
2. API key를 생성합니다.
3. `RESEND_API_KEY`, `EMAIL_FROM`을 설정합니다. 발신 주소 예: `모아타임 <booking@your-domain.com>`.

예약 확정·취소 시 **예약자와 주최자 각각**에게 요청합니다. 두 이메일이 같으면 한 통만 보냅니다. 주최자 주소는 Supabase 사용자 정보에서, 외부 예약자 주소는 Google 로그인으로 확인된 이메일에서 가져옵니다.

동일 작업은 동일 Idempotency-Key를 사용합니다. 공급자의 24시간 중복 방지 기간 안에서 처리하도록 작업 유효 기간을 23시간으로 제한하고, 일시적 이메일 오류는 최대 3회 시도합니다. [도메인 인증](https://resend.com/docs/dashboard/domains/introduction), [Idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys)

## 4. 문자: SOLAPI

1. SOLAPI 계정의 인증 절차를 완료합니다.
2. 실제 **발신번호를 등록·인증**하고 요금/잔액을 준비합니다.
3. API Key/Secret을 생성합니다.
4. `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_FROM`을 입력합니다. 발신번호는 하이픈 없는 숫자입니다.

문자 수신을 선택한 국내 휴대전화로 확정·취소 알림을 보냅니다. 본문 길이를 고려해 **LMS 장문 문자**로 요청합니다. [공식 발송 예제](https://solapi.com/developers/sdk/nodejs-sendingexample)

## 5. 카카오 알림톡: SOLAPI

1. 카카오톡 비즈니스 채널을 SOLAPI에 연결합니다.
2. 채널 PF ID를 `KAKAO_PF_ID`에 입력합니다.
3. 아래 확정/취소 템플릿을 등록·심사받습니다.
4. 승인된 ID를 `KAKAO_TEMPLATE_CONFIRMED`, `KAKAO_TEMPLATE_CANCELLED`에 입력합니다.

등록용 초안 — 예약 확정:

```text
[모아타임] 예약 확정 안내
#{이름}님, 예약이 확정되었습니다.
일정: #{일정명}
일시: #{일시}
소요 시간: #{소요시간}분
```

등록용 초안 — 예약 취소:

```text
[모아타임] 예약 취소 안내
#{이름}님, 예약이 취소되었습니다.
일정: #{일정명}
일시: #{일시}
소요 시간: #{소요시간}분
```

위 문구는 **승인 전 초안**입니다. 승인된 변수명이 달라지면 `lib/notifications/providers.ts`의 변수 매핑도 맞춥니다. 알림톡을 선택한 수신자에게만 요청합니다.

`disableSms: true`로 실패 시 문자 자동 대체발송을 껐습니다. 문자와 알림톡을 모두 선택하면 각각 발송·과금됩니다. [채널·템플릿 연결](https://guide.solapi.com/f32847ef-390e-4d1f-a724-e2d019d7901e), [대체발송](https://solapi.com/developers/api/messages-disablesms)

## 6. Vercel

1. Add New Project → `sellease-tony/moretime` Import.
2. Framework **Next.js**, Root 저장소 루트, Production Branch **main**.
3. 아래 값을 Environment Variables에 설정합니다.

| 환경변수 | 내용 |
|---|---|
| `APP_URL` | 최종 서비스 URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 공개 키 |
| `SUPABASE_SECRET_KEY` | 서버 Secret key 또는 service_role |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Supabase와 동일한 Google OAuth 클라이언트 |
| `CALENDAR_TOKEN_ENCRYPTION_KEY` | 32바이트 base64 비밀키 |
| `NOTIFICATION_MODE` | `off` / `dry-run` / `live` |
| `RESEND_API_KEY`, `EMAIL_FROM` | 이메일 설정 |
| `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_FROM` | 문자·알림톡 공통 설정 |
| `KAKAO_PF_ID` | 채널 ID |
| `KAKAO_TEMPLATE_CONFIRMED`, `KAKAO_TEMPLATE_CANCELLED` | 승인 템플릿 ID |
| `CRON_SECRET` | 32자 이상 무작위 비밀값 |

4. Deploy 후 최종 URL을 `APP_URL`과 Supabase URL Configuration에 맞추고 재배포합니다. 도메인 변경 시도 동일합니다.
5. Google 로그인 → 예약 페이지 생성 → 링크 복사 → 다른 Google 계정으로 공개 링크 예약 → 양쪽 이메일 수신 순서로 검증합니다.

예약 직후 `after()`로 즉시 발송을 처리합니다. 현재 Hobby 초기 배포를 위해 `vercel.json`에는 Cron을 등록하지 않았으며 알림 모드는 `off`로 유지합니다. 실제 알림 운영 전에 남은 대기/재시도를 처리하는 스케줄러를 연결해야 합니다. 1분 Cron 지원 플랜에서는 `"crons": [{"path":"/api/cron/notifications","schedule":"* * * * *"}]`를 추가할 수 있습니다. 엔드포인트는 Authorization 헤더의 `CRON_SECRET`으로 보호합니다. Hobby는 하루 한 번 제한이 있습니다. [Cron 운영](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [플랜별 주기](https://vercel.com/docs/cron-jobs/usage-and-pricing)

GitHub push가 자동 배포되려면 Vercel Import 연결을 먼저 완료해야 합니다.

## 모드와 상태

- `off`: 실제 전송 없이 `disabled`. 나중에 live로 바꾸어도 과거 off 작업은 보내지 않습니다.
- `dry-run`: 공급자 호출 없이 `simulated` 기록.
- `live`: 실제 전송 요청. 키가 없으면 `blocked` 기록.
- `accepted`: 공급자 접수. **최종 수신 성공은 아니며** 공급자 콘솔에서 확인해야 합니다.
- `unknown`: 문자·알림톡 접수 여부가 불명확함. 중복과금 방지를 위해 자동 재발송하지 않습니다.
- `expired`: 23시간 지난 대기 작업은 발송하지 않습니다.

예약과 알림은 별개이며 알림 실패가 예약을 취소하지 않습니다. 설정 화면에서 최근 기록을 확인합니다. `blocked`/`unknown`의 재발송은 공급자 기록 대조 후 운영자 처리가 필요합니다. 자동 재발송 버튼은 제공하지 않습니다.

## 검증 범위와 후속 작업

완료한 로컬 검증: Next.js 빌드·타입 검사, PostgreSQL 트랜잭션·RLS·예약 충돌·작업 잠금, Google 시간 경계·종일 일정·부분 조회 오류, 모의 발송, 이메일 중복 방지, 알림톡 문자 대체 차단.

실제 Supabase/Google/Resend/SOLAPI 성공은 키와 계정 설정 후 확인해야 합니다. 이번 작업에서 외부 메시지나 요금제 결제를 실행하지 않았습니다.

후속 범위: 기업 조직 권한·팀원 초대·다중 주최자 공동 가능 시간, Google Calendar 이벤트 생성, 셀프 취소/변경, 미팅 전 리마인더, 최종 수신 Webhook, 운영 개인정보 보존·삭제 정책.

## 페이지별 가능 시간
예약 페이지 만들기 또는 카드의 날짜·가능 시간 설정에서 날짜별 시작 시간을 선택합니다. 주간 가능 시간은 기간 채우기에 쓰는 템플릿이며, 직접 고른 날짜는 요일 제한과 무관하게 저장할 수 있습니다. Google 빈 시간 자동 선택은 선택한 기간만 교체하며 저장 버튼을 눌러야 공개됩니다. 기존 페이지는 날짜를 처음 설정하기 전까지 예약을 받지 않습니다.
공개 달력은 월별 DB 조회와 20초 갱신을 사용하고, 예약 확정 시 워크스페이스 행 잠금·revision·선택 시간 검증·주최자 전체 예약 겹침 검증을 같은 트랜잭션으로 수행합니다. 취소하면 원래 선택되어 있던 시간이 다시 열립니다. Google 일정 기록과 알림은 예약 커밋 후 처리됩니다.
