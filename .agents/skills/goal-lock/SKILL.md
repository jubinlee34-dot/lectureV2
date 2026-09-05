---
name: goal-lock
description: "lectureV2 구현 중 목표 이탈과 검증 없는 완료 보고를 방지한다. PLAN→DO→VERIFY 루프를 적용한다."
user_invocable: true
---

# goal-lock

## 목적
승인된 작업의 목표와 완료 기준을 고정하고, 구현 후 실제 검증 증거가 있을 때만 완료로 보고한다.

## 입력
scope-lock 결과 또는 사용자가 승인한 작업 계획에서 아래를 가져온다.
- GOAL
- SCOPE IN / OUT
- DONE EVIDENCE
- CONSTRAINTS

## 실행 루프
### 1. PLAN
- 수정 대상과 접근 방법을 짧게 정리한다.
- 승인되지 않은 범위가 필요한지 확인한다.
- 필요하면 구현 전에 멈추고 보고한다.

### 2. DO
- SCOPE IN만 수정한다.
- 관련 없는 리팩터링을 하지 않는다.
- 새 문제를 발견해도 현재 목표와 무관하면 후속 작업 후보로 남긴다.

### 3. VERIFY
가능한 범위에서 실제 명령과 기능 검증을 수행한다.
기본 검증:
- `pnpm run check`
- `pnpm run build`
- `git diff --check`
추가 검증은 작업 특성에 따라 E2E, 로그인, CRUD, DB/RLS/ACL, console error 등을 포함한다.

### 4. REPORT
실패·미검증 항목을 먼저 보고하고, 성공 항목을 뒤에 보고한다.

## 완료 판정
아래 중 하나라도 해당하면 `완료`라고 보고하지 않는다.
- 마지막 수정 이후 검증을 다시 실행하지 않음
- DONE EVIDENCE 일부가 실패함
- 브라우저/E2E 등 필요한 증거를 확인하지 못함
- 승인되지 않은 범위 변경이 포함됨
- 실제 실행 없이 추론만으로 정상이라고 판단함

## 금지 패턴
- 실패 테스트 삭제/skip으로 통과시키기
- 기준 완화로 성공 처리하기
- 테스트 입력에 맞춘 하드코딩
- 오류 로그 숨기기
- 단위 테스트 통과를 사용자 기능 전체 검증으로 과장하기
- `아마 된다`, `문제없어 보인다`처럼 미검증 상태를 성공처럼 표현하기

## 승인 경계
DB schema, migration 실행, production DB, 환경변수 이름, 인증 방식, OAuth scope, 보안/개인정보 구조, commit, push, PR, merge, 배포는 AGENTS.md의 승인 규칙을 그대로 따른다.
