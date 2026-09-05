---
name: scope-lock
description: "lectureV2 구현 전에 작업 범위를 GOAL/IN/OUT/DONE/RISK로 고정한다. 불필요한 확장을 막는다."
user_invocable: true
---

# scope-lock

## 목적
구현 전에 이번 작업의 실행 계약을 짧게 고정한다.

## 출력 항목
- **GOAL**: 단일 목적 1문장
- **IN**: 이번 작업에서 수정·확인할 범위
- **OUT**: 건드리지 않을 영역
- **DONE**: 실행 가능한 완료 증거
- **RISK**: DB, migration, 인증, 개인정보, 외부 API, 데이터 손실 등

## 규칙
- 한 작업에는 하나의 목적만 둔다.
- OUT은 반드시 명시한다.
- IN에 포함된 파일이라도 요청하지 않은 기능 변경은 허용되지 않는다.
- 범위 밖 문제는 수정하지 않고 후속 작업 후보로만 기록한다.
- 승인 경계는 AGENTS.md를 따른다. 여기서 반복 정의하지 않는다.
- 간단한 1파일 수정은 한 줄씩 축약 가능하다.

## 완료 기준 작성 원칙
DONE은 추상적 표현 대신 실제 확인 방법으로 작성한다.
예: `pnpm run check`, `pnpm run build`, `git diff --check`, 지정 E2E 시나리오.

## 전달 규칙
이 결과는 goal-lock의 입력 계약으로 그대로 넘긴다. goal-lock에서 다시 작성하지 않는다.
