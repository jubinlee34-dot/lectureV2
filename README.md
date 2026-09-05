# lectureV2

강의 일정, 할 일, 자료와 관련 정보를 통합 관리하기 위한 웹 애플리케이션입니다.

## 프로젝트 개요

lectureV2는 강의 운영 과정에서 발생하는 일정, 할 일, 강의 정보, 자료 등을 한 곳에서 관리하기 위해 개발하고 있습니다.

주요 개발 방향은 다음과 같습니다.

- 강의 정보 관리
- 강의별 할 일 관리
- 삭제 강의 휴지통 및 복원
- 일정 및 외부 서비스 연동
- 사용자 인증
- 데이터 안전성 및 개인정보 보호
- 실제 운영을 고려한 배포·검증 체계

## 기술 구성

- React 19
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Supabase
- Express
- Vercel
- pnpm

주요 실행 명령:

```bash
pnpm run dev
pnpm run check
pnpm run build
```

## 프로젝트 구조

```text
lectureV2/
├─ client/                  프론트엔드
│  └─ src/
│     ├─ pages/
│     ├─ components/
│     ├─ contexts/
│     ├─ hooks/
│     └─ lib/
├─ server/                  서버 관련 코드
├─ shared/                  공용 타입 및 상수
├─ supabase/                DB migration 등
├─ docs/                    운영 및 기술 문서
├─ .agents/
│  └─ skills/               Codex 작업 스킬
├─ AGENTS.md                AI 작업 운영 원칙
└─ README.md
```

## AI 작업 하네스

lectureV2는 Codex 등 AI 코딩 에이전트가 프로젝트를 안정적으로 수정할 수 있도록 저장소 내부에 작업 하네스를 두고 있습니다.

### AGENTS.md

`AGENTS.md`는 프로젝트 작업의 최상위 운영 규칙입니다.

주요 역할:

- 작업 범위 통제
- 사용자 승인 경계
- Notion과 GitHub의 역할 구분
- 구현 및 검증 원칙
- 필요한 스킬만 선택적으로 사용하는 Context Budget
- 작업 완료 기준

### 작업 스킬

현재 다음 4개 스킬을 사용합니다.

```text
.agents/skills/
├─ next-action/
│  └─ SKILL.md
├─ scope-lock/
│  └─ SKILL.md
├─ goal-lock/
│  └─ SKILL.md
└─ pre-push/
   └─ SKILL.md
```

| 스킬 | 역할 |
|---|---|
| `next-action` | Notion과 GitHub 상태를 바탕으로 다음 작업 후보를 제안 |
| `scope-lock` | GOAL / IN / OUT / DONE / RISK를 고정 |
| `goal-lock` | 승인된 범위에서 PLAN → DO → VERIFY → REPORT 실행 |
| `pre-push` | push 직전 민감정보, 위험 변경, 검증 상태와 diff 확인 |

모든 스킬을 매 작업마다 읽지 않습니다. 현재 단계에 필요한 스킬만 선택적으로 사용하여 불필요한 컨텍스트와 토큰 사용을 줄입니다.

## 기본 작업 루프

```text
Notion 확인
↓
GitHub 기준점 확인
↓
필요한 조사
↓
우선순위 판단
↓
next-action
↓
사용자 선택 / 승인
↓
scope-lock
↓
goal-lock
↓
구현
↓
검증
↓
pre-push (필요 시)
↓
결과 보고
↓
요청 시 Notion 기록
```

사용자가 이미 구체적인 작업을 지정한 경우 `next-action`은 생략할 수 있습니다.

push 계획이 없는 작업에서는 `pre-push`를 사용하지 않습니다.

## Notion과 GitHub의 역할

```text
Notion
= 작업 계획 / 우선순위 / 결정 / 인수인계

GitHub
= 실제 코드 / branch / commit / PR / CI
```

두 기록이 충돌하는 경우 실제 구현 상태인 GitHub를 기준으로 판단하고 차이를 확인합니다.

## 사용자 승인 경계

다음 작업은 사용자 승인 없이 진행하지 않습니다.

- DB schema 변경
- migration 실행
- production DB 변경
- 환경변수 이름 변경
- 인증 방식 변경
- OAuth scope 확대
- 보안 정책 변경
- 개인정보 처리 구조 변경
- commit
- push
- PR 생성
- merge
- 배포

이미 승인된 동일 작업 범위는 반복해서 승인 요청하지 않습니다.

## 검증 원칙

코드 변경 후 기본적으로 다음 검증을 수행합니다.

```bash
pnpm run check
pnpm run build
git diff --check
```

작업 특성에 따라 추가로 확인합니다.

- 브라우저 E2E
- 로그인 / 로그아웃
- CRUD
- 오류 경로
- DB migration history
- RLS / ACL
- console error

검증하지 못한 항목은 성공 또는 완료로 기록하지 않습니다.

## Context Budget

AI 작업에서 전체 프로젝트를 매번 읽지 않습니다.

- 현재 작업과 관련된 문서만 확인
- 필요한 스킬만 로드
- Notion은 관련 작업 기록부터 확인
- GitHub는 현재 상태와 관련 파일부터 확인
- 저장소 전체 탐색은 필요한 경우에만 확대
- 이미 확인한 동일 규칙이나 상태를 반복 로드하지 않음

이를 통해 작업 범위를 줄이고 불필요한 토큰 사용을 줄이는 것을 목표로 합니다.

## 개발 원칙

- 한 작업에는 하나의 목적만 둡니다.
- diff를 작게 유지합니다.
- 관련 없는 리팩터링을 함께 하지 않습니다.
- 기존 기능을 불필요하게 변경하지 않습니다.
- 검증 없는 완료 보고를 하지 않습니다.
- 위험 변경은 반드시 사용자 승인 후 진행합니다.

## 상태

현재 프로젝트는 기능 개발과 운영 안정화가 함께 진행 중입니다.

향후 작업은 Notion 작업판의 우선순위와 GitHub 실제 상태를 함께 확인해 결정합니다.
