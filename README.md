# 모아타임 / moretime

일정 예약 SaaS. **Next.js + Vercel + Supabase + Google Calendar + Resend**.

## 연결 및 실행

1. [한국어 연결 가이드](docs/SETUP.ko.md)에 따라 Supabase SQL, Google OAuth, 이메일 발송, 스케줄러를 설정합니다.
2. `.env.example`을 `.env.local`로 복사하고 값을 입력합니다. 비밀키는 커밋하지 않습니다.
3. `npm ci`, `npm run dev`를 실행합니다.
4. Vercel에서 이 저장소의 `main` 브랜치를 Import하고 환경변수를 설정합니다.

```sh
npm ci
npm test
npm run build
npm run dev
```

## 구현 범위

- Google 로그인만 제공하는 Supabase Auth. 주최자는 로그인 시 서버가 `app_metadata.moa_role='host'`를 기록하며, 예약 화면에서 입력 편의로 로그인한 게스트는 워크스페이스·주최자 API에 접근할 수 없습니다.
- 개인 예약 페이지, 공개 예약 링크 `/book/[id]`, 고객사 지정 링크와 회사명·미팅 제목 규칙
- 기본/표시 중인 Google 캘린더의 바쁜 시간 제외, 한국 공휴일 제외, 오프라인 미팅 앞뒤 60분 이동시간 확보
- Google 변경 알림(webhook)과 1분 주기 백그라운드 동기화. 조회 오류 시 예약을 닫고 일정 제목·내용은 공개하지 않음
- 확정 예약을 주최자 기본 Google 캘린더에 생성하고 취소 시 삭제
- 외부 예약자는 로그인 없이 예약하고, 받은 개인 관리 링크로 직접 변경·취소
- 그룹 일정 투표(`/poll/[id]`): 비공개 응답, 예상 인원 전원이 가능한 시간만 확정, 참석자별 안내 메일
- PostgreSQL 예약, 계정별 RLS, 행 잠금·revision으로 동시 수정·겹치는 예약 방지
- 확정·취소·변경 이메일(예약자·주최자 각각)과 하루 전·1시간 전 이메일 리마인더
- 예약과 발송 대기 기록을 함께 저장하는 트랜잭션, 작업 잠금·접수 상태·오류 기록, Resend 중복 방지 키
- 공개 예약·투표 응답의 IP·링크별 요청 제한

기본 알림 모드는 `off`. `dry-run`은 외부 전송 없이 검증, `live`는 실제 발송 요청입니다. 공급자 접수와 최종 수신 성공은 구분합니다. 테스트는 PGlite PostgreSQL과 모의 API를 사용하며 실제 메시지를 보내지 않습니다.

**문자·카카오 알림톡은 현재 제공하지 않습니다.** 예약자 화면에서 선택할 수 없고, 기존 예약에 남은 문자·알림톡 작업은 발송하지 않고 `blocked`로 기록합니다. SOLAPI 연동 코드(`lib/notifications/providers.ts`)는 추후 제공을 위해 남겨 두었습니다.

## 스케줄러

Vercel Cron은 사용하지 않습니다. Supabase `pg_cron` + `pg_net`이 매분 `/api/cron/calendar`와 `/api/cron/notifications`를 호출합니다. 등록 방법은 [스케줄러 가이드](docs/SCHEDULER.ko.md)를 참고하세요.

## 후속 범위

기업 조직 권한·팀원 초대·다중 주최자 캘린더(현재 팀 화면은 표시만 있음), 문자·카카오 알림톡, 최종 수신 결과 Webhook, `blocked`/`unknown` 작업 재발송 도구, 운영 개인정보 보존·삭제 정책.

기존 D1 데모 데이터는 자동 이전하지 않습니다. 이전 Cloudflare 코드는 `legacy/cloudflare/`에 보관되어 있으며 현재 실행 경로에서 사용하지 않습니다.
