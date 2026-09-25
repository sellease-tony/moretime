# 구글 캘린더 백그라운드 동기화

`202609250001_calendar_background.sql`을 Supabase SQL Editor에서 한 번 적용한다.
기존 연결은 작업 큐에 등록되며, 새 연결/재로그인은 DB 트리거가 등록한다.

운영 `APP_URL`은 공개 HTTPS 주소여야 한다. `CRON_SECRET`은 서버 전용이며
Supabase Vault에 같은 값을 `moretime_calendar_cron` 이름으로 저장한다.
구글 권한은 기존 calendar.events.freebusy / calendar.events.owned 및
calendar.calendarlist.readonly를 사용한다. 게스트 권한은 변경하지 않는다.

Supabase에서 pg_cron, pg_net 확장을 활성화하고 다음 작업을 등록한다.
비밀 값 자체를 SQL 파일, Git 또는 cron 명령에 직접 넣지 않는다.

```sql
select cron.schedule('moretime-calendar-background', '* * * * *', $job$
 select net.http_get(
   url := 'https://moretime-pearl.vercel.app/api/cron/calendar',
   headers := jsonb_build_object('Authorization', 'Bearer ' ||
     (select decrypted_secret from vault.decrypted_secrets
      where name = 'moretime_calendar_cron')),
   timeout_milliseconds := 60000
 );
$job$);
```

구글 webhook은 채널 토큰 해시/리소스/유효기간을 검증하고 작업을 먼저 저장한 후
응답한다. Next after에서 처리하며, 중단되면 cron이 2분 lease 만료 후 복구한다.
worker 하나가 주최자 한 명을 처리한다. 알림이 없더라도 성공 후 5분에 다시
조회한다. 이는 처리 대기열과 외부 서비스 상태에 따라 지연될 수 있는 목표이며
최대 지연 보장은 아니다. 사용자 수 증가 시 worker 처리량과 쿼터를 확장한다.

표시한 개인 캘린더를 각각 구독하고 만료 24시간 전에 교체한다. 한 실행에서
신규 구독은 최대 5개이며, 나머지는 재시도로 이어간다. 캘린더 목록 변경은
주기적 재조회로 반영한다. 구독 실패 시에도 가능 시간 재조회는 먼저 실행한다.
Google 조회 실패 시 기존 선택을 보존하고 예약 가능 시간은 닫는다.

운영 확인: moa_calendar_jobs.last_success/last_error, 채널 expires_at,
cron.job_run_details, net._http_response의 HTTP 상태를 함께 확인한다.
cron 자체 성공은 HTTP/API 처리 성공을 의미하지 않는다.

중지: `select cron.unschedule('moretime-calendar-background');`
구독은 만료까지 알림을 보낼 수 있으므로 완전 중지 시 Google channels.stop과
채널 정리가 필요하다. 테스트 일정은 참석자/알림 없이 만들고 삭제한다.
