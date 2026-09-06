# Google Calendar 1차 연동

Google 로그인과 별도로 캘린더 화면의 **Google Calendar 연결**을 누를 때 `openid`와 `https://www.googleapis.com/auth/calendar.events.owned` 권한을 요청한다. 기존 Google identity의 `sub`와 토큰의 `sub`, OAuth client ID를 서버에서 검증한다. Google identity가 정확히 하나 연결된 Supabase 계정만 허용하며 다른 Google 계정을 새로 연결하지 않는다.

## 설정

- `.env` 및 서버 런타임에 공개 `VITE_GOOGLE_CLIENT_ID`를 설정한다. Supabase Google 로그인과 동일한 Google OAuth Web Client ID를 사용한다. Client Secret은 앱에 넣지 않는다.
- 기존 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`가 서버 런타임에도 필요하다. 서비스 역할 키는 사용하지 않는다.
- Google Cloud에서 Calendar API 활성화와 실제 개발/운영 origin 등록을 확인한다. 기존 Supabase 로그인 redirect 설정은 유지한다.
- Google 동의 화면과 실제 공개 개인정보처리방침에 일정 조회·등록, sub 계정 검증, 서버의 일시 처리, Google 저장 및 연결 해제 방법을 반영한다. 공개 서비스 OAuth 검증 필요 여부는 Google Console에서 확인한다.
- 개발 Vite, Express, Vercel API는 같은 서버 핸들러를 사용한다. `vite preview`는 API 서버가 아니다.

## 동작과 개인정보

- 주 캘린더만 선택 월 단위로 조회한다. 월 변경 시 다시 조회하며, 조회 실패/페이지 수 제한 시 등록을 차단한다.
- 서버가 기존 강의 소유권과 휴지통 여부를 기존 RLS 하에서 검사한다. 등록 직전에 기존 이벤트 ID와 시간 겹침을 다시 확인한다.
- 시간 겹침 또는 기존 등록이 있으면 등록하지 않는다. 같은 강의는 날짜/제목이 바뀌어도 같은 결정적 이벤트 ID를 사용한다. 외부에서 수정/삭제한 일정은 자동 복구하지 않는다.
- 전송 내용은 제목·기관·시작/종료 시간과 불투명 식별 키다. 담당자 연락처·메모·비용·장소는 전송하지 않는다. 이벤트는 비공개·알림 없음으로 생성한다.
- 날짜/시간은 Asia/Seoul 기준. 구형 `duration`의 `HH:mm ~ HH:mm` 형식을 지원한다. 시간 누락·잘못된 날짜·종일·자정 이후 종료 일정은 강의 수정이 필요하다.
- OAuth 권한은 소유한 캘린더의 수정·삭제도 포함하지만 앱은 조회/등록만 사용한다. 앱의 기능 제한과 OAuth 권한 범위는 다르다.
- Google 토큰과 조회 결과는 화면/요청 메모리에만 둔다. 새로고침·화면 이탈·로그아웃 후 다시 연결한다. Supabase 로그인 세션의 기존 저장 정책은 변경하지 않는다.
- `연결 사용 중지`는 화면 메모리 정리다. Google 동의 철회는 Google 계정의 연결된 앱 관리에서 수행한다. 철회는 로그인 등 앱에 허용한 다른 Google 권한에도 영향을 줄 수 있다.
- 앱 강의 삭제·연결 해제는 Google에 이미 등록된 일정을 삭제하지 않는다. 사용자가 Google Calendar에서 관리한다.
- DB schema, migration, RLS, ACL 변경 없음. Google 토큰/일정 원문과 tokeninfo URL을 로그나 오류 추적에 기록하지 않는다.

## 검증

`pnpm exec vitest run --root . api/_lib/google-calendar.test.ts` (외부 API를 모의한 서버 테스트), `pnpm run check`, `pnpm run build`, `git diff --check`.

실제 계정에서는 연결 성공/거부/부분 동의, 동일 계정 검증, 월별 조회, 시간 겹침, 중복 클릭/재시도, 등록, 만료, 로그아웃/재로그인/재연결과 콘솔 오류를 별도 검증해야 한다. 모의 API 테스트는 실제 Google 동의와 운영 설정의 검증을 대체하지 않는다.

`node tests/calendar-browser/server.mjs`는 별도 포트 4184에서 실제 패널을 사용하는 모의 UI를 실행한다. 응답 시나리오에서 성공·권한 거부·짧은 만료·서버 만료를 선택하고 연결/등록/월 이동/로그아웃을 확인할 수 있다. 실제 Google/DB 호출은 없으며 production 앱이나 빌드에는 포함되지 않는다.

## 제한

자동 동기화·일정 수정/삭제·다른 계정·보조 캘린더·DB 매핑·refresh token 저장은 없다. 서로 다른 강의를 동시에 등록할 때 또는 Google에서 동시에 일정을 만들 때 시간 겹침 검사와 등록 사이를 원자적으로 잠글 수는 없다. 안정적인 ID는 같은 강의의 중복을 억제하지만 Google 분산 시스템의 절대적인 exactly-once 보장을 의미하지 않는다. 결과가 불확실하면 조회 후 같은 강의로 재시도한다.
