---
name: pre-push
description: "lectureV2 push 전 필수 검증과 위험 변경 확인을 수행한다. push 자체는 사용자 명시 승인 후에만 실행한다."
user_invocable: true
---

# pre-push

## 목적
원격 저장소에 push하기 전에 현재 변경이 안전하고 검증 가능한 상태인지 확인한다.

## 실행 조건
사용자가 push를 요청하거나, push 직전 검증을 요청할 때 실행한다.

## Step 1. Git 상태 확인
- 현재 branch
- staged / unstaged 변경
- 변경 파일 목록
- main 직접 작업 여부
- 최근 기준 commit

## Step 2. 민감정보 확인
추가된 diff에서 다음을 확인한다.
- API key / token / password / private key
- `.env` 실제 값
- Supabase / OAuth / 외부 서비스 credential
- 연결 문자열에 포함된 비밀번호
- merge conflict marker

민감정보 가능성이 있으면 push를 중단하고 먼저 보고한다.

## Step 3. 위험 변경 확인
다음 변경이 포함됐는지 확인한다.
- DB schema / migration
- RLS / ACL
- 인증 / OAuth
- 환경변수 이름
- 개인정보 처리
- 외부 API
- 의존성 추가·변경
- 배포 흐름

승인 범위를 벗어난 위험 변경이면 push하지 않는다.

## Step 4. 필수 검증
코드 변경 시 가능한 범위에서 실행한다.
- `pnpm run check`
- `pnpm run build`
- `git diff --check`

기능별 추가 검증이 필요한 경우 goal-lock의 DONE EVIDENCE를 확인한다.

문서만 변경된 경우 build/test는 생략할 수 있지만 `git diff --check`와 변경 내용 검토는 수행한다.

## Step 5. diff 검토
- 요청 범위 밖 변경 여부
- 디버그 코드 / 임시 로그
- 테스트 skip / `.only`
- 의도하지 않은 UI·API·DB 동작 변경
- 자동 생성물이나 불필요한 파일 포함 여부

## 판정
### READY
- 필수 검증 통과
- 민감정보 없음
- 승인되지 않은 위험 변경 없음
- scope 밖 변경 없음

### BLOCKED
위 조건 중 하나라도 충족하지 못함.
실패 또는 미검증 항목을 먼저 보고한다.

## 승인 경계
- pre-push 검사는 읽기·검증 작업이므로 실행 가능하다.
- `git push`는 별도 쓰기 작업이다.
- READY 판정이어도 사용자의 명시적 push 승인 없이는 push하지 않는다.
- main/master 직접 push, PR 생성, merge, 배포는 각각 AGENTS.md의 승인 규칙을 따른다.
