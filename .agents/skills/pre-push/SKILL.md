---
name: pre-push
description: "push 직전에만 로드하여 민감정보·위험 변경·필수 검증·diff 범위를 확인한다. 실제 push는 사용자 승인 후에만 실행한다."
user_invocable: true
---

# pre-push

## 실행 조건
- 사용자가 push를 요청했거나 push 직전 검증이 필요할 때만 사용한다.
- push 계획이 없으면 읽지 않는다.

## 확인 순서
1. **Git 상태**: branch, staged/unstaged, 변경 파일, main 직접 작업 여부, 기준 commit
2. **민감정보**: API key/token/password/private key, `.env` 실제 값, credential, 연결 문자열 비밀번호, conflict marker
3. **위험 변경**: DB/migration/RLS/ACL, 인증/OAuth, 환경변수, 개인정보, 외부 API, 의존성, 배포 흐름
4. **검증**: goal-lock의 DONE 결과 우선 확인. 코드 변경이면 필요 시 `pnpm run check`, `pnpm run build`, `git diff --check`
5. **diff**: scope 밖 변경, 임시 로그, test skip/`.only`, 의도하지 않은 UI/API/DB 변경, 불필요한 파일

문서만 변경된 경우 build/test는 생략할 수 있으나 `git diff --check`와 내용 검토는 수행한다.

## 판정
### READY
- 필요한 검증 통과
- 민감정보 없음
- 승인되지 않은 위험 변경 없음
- scope 밖 변경 없음

### BLOCKED
하나라도 충족하지 못하면 실패·미검증 항목을 먼저 보고하고 push하지 않는다.

## 승인
읽기·검증은 수행할 수 있으나 실제 `git push`, main/master 직접 push, PR 생성, merge, 배포는 AGENTS.md 승인 경계를 따른다.
