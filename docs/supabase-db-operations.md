# Supabase DB 운영 가이드

## Supabase public 테이블 생성 시 anon 기본 권한 주의

### 확인된 현재 상태

- 이 프로젝트의 `pg_default_acl`(`public` 스키마, `defaclrole=postgres` 및
  `defaclrole=supabase_admin`)은 `public` 스키마에 새 테이블을 만들 때
  `anon`에게 테이블 권한(`arwdDxtm` = SELECT/INSERT/UPDATE/DELETE/TRUNCATE/
  REFERENCES/TRIGGER/MAINTAIN)을 자동으로 부여하도록 설정되어 있음이
  read-only `pg_catalog` 조회로 확인됨. 이 저장소의 어떤 migration 파일도
  이 default를 직접 설정하지 않았으며, Supabase 플랫폼 레벨의 기존 설정임.
- `lectures`, `todos`, `work_tasks`, `sms_history`, `lecture_contact_logs`,
  `instructor_profile` 6개 테이블에서 `MAINTAIN`/`REFERENCES`/`TRIGGER`/
  `TRUNCATE` 권한이 `anon`에 잔존했던 원인은 위 default ACL과, 이전 정리
  migration(`20260809000100_remove_anon_grants_dedupe_contact_fk.sql`, 현재
  `docs/migrations-archive/`에 보관)이 SELECT/INSERT/UPDATE/DELETE 4종만
  회수하고 나머지 4개 권한을 놓친 것이 결합된 결과였음.
- `supabase/migrations/20260818130349_revoke_residual_anon_privileges.sql`
  (F-2)로 위 6개 테이블에 남아 있던 anon 잔존 권한을 모두 회수 완료함.
- `message_drafts`는 생성 migration
  (`20260728000100_add_message_drafts.sql`)이 테이블 생성 직후부터
  `REVOKE ALL ON TABLE public.message_drafts FROM anon;`을 실행해 두었기
  때문에 같은 문제가 처음부터 발생하지 않았음.
- Production 재확인 결과, 위 6개 테이블 + `message_drafts`의 `anon` 직접
  table-level grant는 모두 0건이며, `authenticated`/`service_role` 권한과
  애플리케이션 CRUD 동작에는 변화가 없음을 확인함.

## 신규 public 테이블 migration 작성 규칙

앞으로 `public` 스키마에 새 테이블을 추가하는 migration에서, **anon
접근이 필요하지 않은 테이블**이라면 다음을 반드시 지킨다. (`pg_default_acl`이
새 테이블에 anon 권한을 자동으로 얹기 때문에, 아무 조치도 하지 않으면
같은 문제가 재발한다.)

**A. `CREATE TABLE` 직후 명시적으로 회수한다**

```sql
REVOKE ALL ON TABLE public.<table_name> FROM anon;
```

**B. migration의 `COMMIT` 전에 사후 ACL 검증을 넣는다**

검증 원칙:
- `pg_class.relacl` + `aclexplode`로 실제 ACL을 읽는다 (선언만 보고 믿지
  않는다).
- `anon`의 OID를 숫자로 하드코딩하지 않고 `'anon'::regrole`로 확인한다.
- SELECT/INSERT/UPDATE/DELETE 같은 특정 CRUD 권한만 검사하지 말고, 해당
  신규 테이블에서 `anon`에 대한 **직접 table-level grant 존재 여부 자체**를
  검사한다.
- 잔존 grant가 하나라도 있으면 `RAISE EXCEPTION`으로 migration 전체를
  실패시켜, 같은 트랜잭션 안의 REVOKE까지 롤백되도록 한다.

(F-2 migration의 사후 검증 블록이 이 패턴의 참고 구현이다.)

**C. RLS와 GRANT는 서로 다른 보안 계층이다**

RLS policy가 정상적으로 설정되어 있어도, table-level `GRANT` 상태를
별도로 확인해야 한다. RLS는 "어떤 행에 접근 가능한가"를 제어하고, GRANT는
"그 role이 테이블에 접근할 수 있는가" 자체를 제어한다. 하나가 정상이라고
다른 하나도 정상이라고 가정하지 않는다.

## 예외: 의도적으로 anon 접근이 필요한 테이블

위 규칙은 "의도하지 않은 anon 권한을 남기지 않는다"가 기본 원칙이며,
**공개 접근이 실제로 필요한 테이블에서 anon 권한 자체를 금지하는 규칙이
아니다.** 정말 공개 접근이 필요한 테이블이라면:

- anon 접근이 필요한 이유를 설계 단계에서 명시적으로 남기고 승인받는다.
- `GRANT ALL`이 아니라 실제로 필요한 최소 권한만 부여한다
  (예: `GRANT SELECT ON TABLE public.<table_name> TO anon;`).
- 그 권한이 RLS 정책과 함께 의도한 대로 동작하는지 검증한다.

## 보류 사항: `pg_default_acl` 자체 변경

`pg_default_acl` 설정 자체를 바꿔서 신규 테이블에 anon 권한이 자동으로
붙는 것을 구조적으로 차단하는 방법(`ALTER DEFAULT PRIVILEGES` 등)은 이번
단계에서 실행하거나 권장으로 확정하지 않는다.

이유:
- 이 프로젝트에서 `postgres`와 `supabase_admin` 양쪽에 관련 default ACL이
  걸려 있는 것이 확인되었고, 이는 Supabase 플랫폼이 내부적으로 관리하는
  role들이다.
- Supabase 플랫폼 동작(예: 대시보드/마이그레이션 도구가 이 default ACL에
  의존하는지 여부)과의 관계를 추가로 검증해야 한다.
- 구조적 변경의 영향 범위가 F-2(개별 테이블 6개의 잔존 권한 회수)보다
  훨씬 크다 — `postgres`/`supabase_admin`이 만드는 모든 향후 public
  테이블에 영향을 준다.

**TODO**: pg_default_acl 자체를 변경하여 신규 테이블의 anon 자동 권한
부여를 구조적으로 차단할 수 있는지 별도 조사 필요.

## Migration 작성/검토 체크리스트

DB migration을 작성하거나 리뷰할 때 사용한다.

- [ ] 새 public 테이블이 생성되는가?
- [ ] anon 접근이 실제로 필요한가?
- [ ] 불필요하면 `REVOKE ALL ... FROM anon`을 명시했는가?
- [ ] RLS를 활성화했는가?
- [ ] 필요한 RLS 정책을 만들었는가?
- [ ] `aclexplode`로 실제 anon ACL을 검증하는가? (선언만 보고 믿지 않았는가)
- [ ] 사후 검증이 `COMMIT` 전에 위치해서, 실패 시 앞선 변경도 함께
      롤백되는가?
- [ ] migration 적용 후 `supabase migration list --linked`로 local/remote
      history가 일치하는지 확인했는가?
