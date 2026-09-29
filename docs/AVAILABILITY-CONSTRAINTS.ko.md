# Google 일정·공휴일 제외

- 주최자 편집 화면을 열면 인증된 `/api/availability/constraints`에서 오늘 00:00(KST)부터 90일 뒤 날짜의 24:00까지 조회합니다. 선택 가능한 모든 날짜를 포함합니다.
- Google FreeBusy의 반복·종일 바쁜 일정과 예약 DB의 확정 일정을 합쳐 시간 충돌을 판정합니다. 일정 제목·내용은 브라우저로 전달하지 않습니다. Google에서 '한가함'으로 지정한 일정은 FreeBusy 기준으로 예약을 막지 않습니다.
- 수동 시간 선택, 기본 시간 선택, 주간 채우기, Google 자동 선택에 같은 충돌 규칙을 적용합니다. 저장 시에도 최신 정보를 조회합니다.
- `availability.excludeHolidays`는 기본 true입니다. 페이지별로 대한민국 공휴일 자동 제외를 해제할 수 있습니다. 기존 페이지도 별도 설정이 없으면 제외합니다.
- 공휴일 출처는 Google의 공개 한국 공휴일 ICS 피드입니다. `DESCRIPTION:Public holiday`만 반영해 일반 기념일은 제외하고 대체공휴일을 포함합니다. 피드는 6시간 캐시하며 해당 연도 데이터가 없거나 조회에 실패하면 가능시간을 열지 않습니다.
- 기존 자동 동기화에도 공휴일 제외를 적용하고, 게스트는 계속 DB에 저장된 가능시간만 조회합니다. 추가 OAuth 권한·API 키·DB 마이그레이션은 없습니다.

참고: [Google FreeBusy](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query), [Google 공휴일 및 기념일](https://support.google.com/calendar/answer/13748345).
