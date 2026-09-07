# Google Calendar 연동

Google 로그인과 별도로 캘린더 화면의 **Google Calendar 연결**을 누를 때 `openid`와 `https://www.googleapis.com/auth/calendar.events.owned` 권한을 요청한다. 기존 Google identity의 `sub`와 토큰의 `sub`, OAuth client ID를 서버에서 검증한다. Google identity가 정확히 하나 연결된 Supabase 계정만 허용하며 다른 Google 계정을 새로 연결하지 않는다.

## 설정

- `.env` 및 서버 런타임에 공개 `VITE_GOOGLE_CLIENT_ID`를 설정한다. Supabase Google 로그인과 동일한 Google OAuth Web Client ID를 사용한다. Client Secret은 앱에 넣지 않는다.
- 기존 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`가 서버 런타임에도 필요하다. 서비스 역할 키는 사용하지 않는다.
- Google Cloud에서 Calendar API 활성화와 실제 개발/운영 origin 등록을 확인한다. 기존 Supabase 로그인 redirect 설정은 유지한다.
- Google 동의 화면과 실제 공개 개인정보처리방침에 일정 조회·등록, sub 계정 검증, 서버의 일시 처리, Google 저장 및 연결 해제 방법을 반영한다. 공개 서비스 OAuth 검증 필요 여부는 Google Console에서 확인한다.
- 개발 Vite, Express, Vercel API는 같은 서버 핸들러를 사용한다. `vite preview`는 API 서버가 아니다.

## 월 전체 등록 동작

- 주 캘린더만 선택 월 단위로 조회한다. 월 변경 시 이동한 월을 다시 조회한다.
- 사용자는 Calendar 화면에서 **이 달 강의 전체 등록**을 실행한다. 개별 강의를 선택해서 등록하는 방식은 사용하지 않는다.
- 클라이언트는 등록 대상 강의 ID 목록을 신뢰 값으로 보내지 않고 현재 월(`YYYY-MM`)만 서버에 전달한다.
- 서버는 로그인 사용자의 `user_id`, `deleted_at is null`, 해당 월 날짜 범위를 다시 적용해 등록 가능한 강의를 조회한다.
- 각 강의는 제목·기관·시작/종료 시간만 Google 이벤트로 변환한다. 담당자 연락처·메모·비용·장소는 전송하지 않는다.
- 이벤트는 비공개·알림 없음으로 생성한다.
- 처리 결과는 `등록 N건 / 중복 제외 N건 / 실패 N건`으로 표시한다.
- 개별 강의 데이터 오류나 일반적인 항목별 등록 실패가 있어도 이미 성공한 Google 일정을 되돌리지 않고 나머지 강의를 계속 처리한다.
- 로그인 세션 만료, Google 권한 만료·취소, 계정 불일치처럼 연결 자체가 무효인 오류는 기존 정책대로 일괄 처리를 중단하고 재연결을 요구한다.

## 중복 판정

중복은 다음 순서와 기준으로 판정한다.

1. 같은 lectureV2 강의에서 생성한 deterministic Google event id가 이미 있거나 삭제 이력이 확인되면 `중복 제외`한다.
2. Google Calendar에 **제목 + 시작시간 + 종료시간이 모두 동일**한 일정이 있으면 `중복 제외`한다.
3. 제목이 다르거나 시작·종료가 다른 일정은 시간이 일부 또는 전부 겹쳐도 등록을 허용한다.
4. 취소된 Google 일정은 제목·시간 비교 중복 대상으로 사용하지 않는다.
5. 같은 batch에서 먼저 생성된 일정은 즉시 비교 목록에 반영해 뒤쪽 강의가 같은 제목·시작·종료라면 추가 생성하지 않는다.

같은 강의는 날짜나 제목이 바뀌더라도 같은 deterministic event id를 사용한다. 따라서 이미 Google에 등록했던 같은 강의를 lectureV2에서 수정한 뒤 다시 실행해도 새 이벤트를 자동 생성하거나 기존 Google 이벤트를 자동 수정하지 않는다. Google에서 삭제한 등록 이력도 자동 복구하지 않는다.

## 날짜·시간과 개인정보

- 날짜/시간은 `Asia/Seoul` 기준이다.
- 구형 `duration`의 `HH:mm ~ HH:mm` 형식을 지원한다.
- 시간 누락, 잘못된 날짜, 종일 일정, 자정 이후 종료 일정은 해당 항목을 실패로 집계하며 강의 데이터 수정이 필요하다.
- exact duplicate의 시작·종료 비교는 문자열 표기 자체가 아니라 timestamp 기준으로 비교해 timezone 표기 차이를 허용한다.
- OAuth 권한은 소유한 캘린더의 수정·삭제도 포함하지만 앱은 조회/등록만 사용한다. 앱의 기능 제한과 OAuth 권한 범위는 다르다.
- Google access token과 조회 결과는 화면/요청 메모리에만 둔다. 새로고침·화면 이탈·로그아웃 후 다시 연결한다. Supabase 로그인 세션의 기존 저장 정책은 변경하지 않는다.
- `연결 사용 중지`는 화면 메모리 정리다. Google 동의 철회는 Google 계정의 연결된 앱 관리에서 수행한다. 철회는 로그인 등 앱에 허용한 다른 Google 권한에도 영향을 줄 수 있다.
- 앱 강의 삭제·연결 해제는 Google에 이미 등록된 일정을 삭제하지 않는다. 사용자가 Google Calendar에서 관리한다.
- DB schema, migration, RLS, ACL 변경 없음. Google 토큰, 일정 원문, tokeninfo URL을 로그나 오류 추적에 기록하지 않는다.

## 검증

로컬에서 다음을 실행한다.

- `pnpm exec vitest run --root . api/_lib/google-calendar.test.ts`
- `pnpm run check`
- `pnpm run build`
- `git diff --check`

서버 테스트는 최소한 빈 월, 1건·여러 건, deterministic id 중복, 동일 제목+시작+종료 중복, 시간만 겹치는 다른 일정, 일부 실패, 같은 batch 내부 중복, 재실행 idempotency, 이전/다음 월 범위를 확인한다.

실제 계정에서는 Preview에서 다음을 별도 검증한다.

1. Google Calendar 연결 성공과 권한 거부·만료·재연결
2. 현재 월 전체 등록과 결과 집계
3. 같은 월 재실행 시 신규 중복이 생기지 않음
4. 제목·시작·종료가 같은 기존 Google 일정은 중복 제외
5. 시간이 겹치지만 다른 일정은 등록 허용
6. 이전 달·다음 달 이동 후 해당 월 강의만 처리
7. 로그아웃·재로그인 후 필요 시 재연결
8. 브라우저 console error 없음

모의 API 테스트는 실제 Google 동의, Preview 환경변수, Google Cloud 운영 설정의 검증을 대체하지 않는다.

`node tests/calendar-browser/server.mjs`는 별도 포트 4184에서 실제 패널을 사용하는 모의 UI를 실행한다. 응답 시나리오에서 성공·권한 거부·짧은 만료·서버 만료를 선택하고 연결, 월 전체 등록, 재실행 중복 제외, 월 이동, 로그아웃을 확인할 수 있다. 실제 Google/DB 호출은 없으며 production 앱이나 빌드에는 포함되지 않는다.

## 제한

자동 동기화, 기존 Google 일정 자동 수정·삭제, 다른 Google 계정, 보조 캘린더, DB 매핑, refresh token 저장은 지원하지 않는다.

월 전체 등록은 서버에서 항목별로 순차 처리하지만 Google Calendar와 lectureV2 사이의 분산 트랜잭션은 아니다. 같은 batch 안의 중복은 생성 직후 비교 목록에 반영해 억제하지만, 서로 다른 요청이 동시에 같은 제목·시간의 서로 다른 강의를 등록하는 극단적인 경쟁 상황까지 원자적으로 잠글 수는 없다. deterministic event id는 같은 lectureV2 강의의 재실행 중복을 강하게 억제하지만 Google 분산 시스템의 절대적인 exactly-once 보장을 의미하지 않는다. 결과가 불확실하면 Google 일정을 다시 조회한 뒤 같은 월 등록을 재실행한다.
