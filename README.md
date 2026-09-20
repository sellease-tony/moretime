# 모아타임 / moretime

일정 예약 SaaS. **Next.js + Vercel + Supabase + Google Calendar + Resend + SOLAPI**.

## 연결 및 실행

1. [한국어 연결 가이드](docs/SETUP.ko.md)에 따라 Supabase SQL, Google OAuth, 발송 공급자를 설정합니다.
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

- Google 로그인만 제공하는 Supabase Auth·세션 검증
- 기본/표시 중인 Google 캘린더의 바쁜 시간 제외 및 예약 직전 재조회
- 조회 오류 시 예약 중지; 일정 제목·상세 내용 비공개
- 개인 예약 페이지, 주최자 한 명이 관리하는 팀 페이지, 공개 예약 링크 `/book/[id]`
- 외부 신청자는 Google 로그인으로 확인된 이메일로 예약
- PostgreSQL 예약, 계정별 RLS, 동시 수정·겹치는 예약 방지
- 확정·취소 시 예약자와 주최자 각각 이메일; 선택 수신 문자·카카오 알림톡
- 예약과 발송 대기 기록을 함께 저장하는 트랜잭션, 작업 잠금·접수 상태·오류 기록
- Resend 중복 방지 키, 알림톡 실패 시 문자 자동 대체발송 차단

기본 알림 모드는 `off`. `dry-run`은 외부 전송 없이 검증, `live`는 실제 발송 요청입니다. 공급자 접수와 최종 수신 성공은 구분합니다. 테스트는 PGlite PostgreSQL과 모의 API를 사용하며 실제 메시지를 보내지 않습니다.

## 아직 설정/확인이 필요한 것

실제 Supabase 프로젝트 적용, Google 권한 승인, Vercel 배포, 발신 도메인·번호·카카오 템플릿 승인 및 실발송 검증이 필요합니다. 현재 `chatgpt.site` 검토본은 별도이며 GitHub 변경이 그 사이트에 자동 반영되지는 않습니다.

`vercel.json`은 **1분 Cron 지원 플랜**을 전제로 합니다. 예약 직후 즉시 처리하고, Cron이 남은 작업·재시도를 처리합니다. 무료 화면 테스트는 가이드의 Cron 설정을 참고하세요.

후속 범위: 기업 조직 권한·팀원 초대·다중 주최자 캘린더, Google Calendar 이벤트 자동 생성, 예약자 셀프 취소/변경, 미팅 전 리마인더, 최종 수신 결과 Webhook.

기존 D1 데모 데이터는 자동 이전하지 않습니다. 이전 Cloudflare 코드는 `legacy/cloudflare/`에 보관되어 있으며 현재 실행 경로에서 사용하지 않습니다.
