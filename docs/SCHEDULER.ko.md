# 스케줄러: Supabase pg_cron

Vercel Cron 대신 Supabase `pg_cron`이 매분 두 API를 호출합니다. 두 작업은 같은 `CRON_SECRET`을 사용합니다.

| 작업 이름 | 호출 경로 | 하는 일 |
|---|---|---|
| `moretime-calendar-background` | `/api/cron/calendar` | Google 바쁜 시간 재조회, watch 채널 갱신, 캘린더 이벤트 재반영 |
| `moretime-notification-retries` | `/api/cron/notifications` | 리마인더 생성 후 남은 발송 대기·재시도 처리 |

예약 직후에는 `after()`로 즉시 처리하고, cron은 남은 작업과 재시도를 처리합니다.

## 준비

1. Supabase → Database → Extensions에서 `pg_cron`, `pg_net`을 활성화합니다.
2. Vercel의 `CRON_SECRET`과 같은 값을 Supabase Vault에 `moretime_calendar_cron` 이름으로 저장합니다. 비밀값은 SQL 파일, Git, cron 명령에 직접 넣지 않습니다.

```sql
select vault.create_secret('<CRON_SECRET 값>', 'moretime_calendar_cron');
```

## 등록

`<서비스도메인>`을 운영 `APP_URL`의 호스트로 바꿉니다(현재 `moretime-pearl.vercel.app`).

```sql
select cron.schedule('moretime-calendar-background', '* * * * *', $job$
 select net.http_get(
   url := 'https://<서비스도메인>/api/cron/calendar',
   headers := jsonb_build_object('Authorization', 'Bearer ' ||
     (select decrypted_secret from vault.decrypted_secrets where name = 'moretime_calendar_cron')),
   timeout_milliseconds := 60000
 );
$job$);

select cron.schedule('moretime-notification-retries', '* * * * *', $job$
 select net.http_get(
   url := 'https://<서비스도메인>/api/cron/notifications',
   headers := jsonb_build_object('Authorization', 'Bearer ' ||
     (select decrypted_secret from vault.decrypted_secrets where name = 'moretime_calendar_cron')),
   timeout_milliseconds := 60000
 );
$job$);
```

## 확인과 중지

- 등록 확인: `select jobname, schedule from cron.job;`
- 실행 기록: `cron.job_run_details`, HTTP 응답: `net._http_response`. cron 실행 성공이 API 처리 성공을 뜻하지는 않으므로 HTTP 상태도 함께 확인합니다.
- 캘린더 작업 상태: `moa_calendar_jobs.last_success`, `last_error`
- 중지: `select cron.unschedule('moretime-calendar-background');`, `select cron.unschedule('moretime-notification-retries');`
- 도메인을 바꾸면 두 작업을 `cron.unschedule` 후 새 URL로 다시 등록합니다.
