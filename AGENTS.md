# AGENTS.md

## 기본 작업 원칙

- 사용자가 요청하지 않은 기능·파일·설정을 임의로 변경하지 않는다.
- Notion은 작업 계획·우선순위·결정 기록의 기준, GitHub는 실제 구현 상태의 기준이다.
- 둘이 충돌하면 GitHub 실제 상태를 우선하고 차이를 보고한다.
- 검증하지 못한 항목은 통과 또는 완료로 기록하지 않는다.
- commit, push, PR, merge, 배포는 사용자의 명시적 승인 없이 실행하지 않는다.

---

## 작업 스킬

필요한 단계의 스킬만 읽고 사용한다. 모든 스킬을 매 작업마다 로드하지 않는다.

- `.agents/skills/next-action/SKILL.md`: 다음 작업 후보 판단
- `.agents/skills/scope-lock/SKILL.md`: GOAL / IN / OUT / DONE / RISK 고정
- `.agents/skills/goal-lock/SKILL.md`: 승인된 범위 실행 및 검증
- `.agents/skills/pre-push/SKILL.md`: push 직전 검증

스킬은 이 문서의 승인 경계를 대체하지 않는다. 충돌 시 AGENTS.md가 우선한다.

### 통합 실행 루프

**Notion 확인 → GitHub 기준점 확인 → 필요한 조사 → 우선순위 판단 → next-action → 사용자 선택/승인 → scope-lock → goal-lock → 구현·검증 → pre-push(필요 시) → 결과 보고 → 요청 시 Notion 기록**

- 사용자가 이미 특정 작업을 지시한 경우 `next-action`은 생략한다.
- 간단한 1파일 수정은 `scope-lock`을 축약할 수 있다.
- push가 예정되지 않은 작업은 `pre-push`를 읽지 않는다.
- DB·인증·개인정보·보안·migration 관련 작업은 조사와 승인 경계를 생략하지 않는다.

---

## Context Budget

- 현재 작업에 필요한 문서·스킬·파일만 읽는다.
- Notion은 현재 작업 리스트와 관련 기록만 우선 확인한다.
- GitHub는 현재 상태, 관련 PR/CI, 관련 파일부터 확인한다.
- 저장소 전체 탐색은 현재 증거가 부족할 때만 확대한다.
- 같은 사실이나 규칙을 여러 문서에서 반복 로드하지 않는다.
- 이전 대화 전체보다 현재 Notion/GitHub 상태를 우선한다.

---

## 작업 시작 기준점

다음 작업을 시작할 때 가능한 범위에서 확인한다.

- Notion의 진행 중·보류·승인 필요 작업
- 현재 branch / HEAD / origin/main / working tree
- 열린 PR / CI
- 최근 main 변경

바로 코드를 수정하지 말고 필요한 범위만 조사한다. 조사 대상은 관련 코드, 기존 구현 여부, 오류·누락, 영향 파일, DB/migration, 환경변수, 인증·보안·개인정보, 외부 API, 회귀 가능성이다.

우선순위는 기본적으로 다음 순서를 따른다.
1. 개인정보 / 보안 / 데이터 손실
2. 기능 오류
3. 상업화 필수 기능
4. 외부 서비스 연동
5. 사용성 / UX
6. 디자인

---

## 승인 경계

다음은 사용자 승인 없이 실행하지 않는다.

- DB schema 변경 / migration 실행 / production DB 변경
- 환경변수 이름 변경
- 인증 방식 변경 / OAuth scope 확대
- 보안 정책 / 개인정보 처리 구조 변경
- commit / push / PR 생성 / merge / 배포

이미 명시적으로 승인된 동일 범위는 다시 묻지 않는다.

---

## 구현 및 검증 원칙

- 최신 `main`을 기준으로 필요 시 작업 branch를 사용한다.
- 한 작업에는 하나의 명확한 목적을 둔다.
- diff를 작게 유지하고 관련 없는 리팩터링을 하지 않는다.
- 신규 `public` 테이블 생성 시 `docs/supabase-db-operations.md`를 확인한다.

코드 변경 후 기본 검증:
- `pnpm run check`
- `pnpm run build`
- `git diff --check`

필요한 경우 E2E, 로그인/로그아웃, CRUD, 오류 경로, DB migration history, RLS/ACL, console error를 추가 확인한다.

---

## Notion 읽기/쓰기

다음 의미의 요청은 관련 Notion 작업 리스트를 읽을 수 있다: `다음 작업`, `작업 리스트 확인`, `노션 기준`, `작업 시작`, `우선순위`, `이어서 작업`.

Notion 쓰기는 사용자가 `노션 기록`, `노션에 기록`, `작업 기록 남겨줘` 등 동일 의미로 요청한 경우에만 수행한다.

기록 시 기존 관련 페이지가 있으면 이어서 기록하고, 별개 작업이면 `YYYY-MM-DD_상태_작업명` 형식의 하위 페이지를 사용한다.

기록 내용은 인수인계에 필요한 핵심만 남긴다.
- 작업 목적 / 조사 결과 / 수행 작업 / 결정사항
- 변경 파일 / 테스트·검증 / 오류·리스크
- 현재 상태 / 다음 작업
- 가능한 경우 branch / commit / PR / CI / build·test 결과

실패와 미해결 항목을 누락하지 않는다.
