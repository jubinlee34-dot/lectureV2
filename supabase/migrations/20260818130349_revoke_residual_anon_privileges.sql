-- Fix-up migration: revoke residual anon privileges left over from the
-- 2026-08-09 cleanup (20260809000100_remove_anon_grants_dedupe_contact_fk.sql,
-- now archived under docs/migrations-archive/).
--
-- 2026-08-09 REVOKE 마이그레이션이 CRUD 4종만 회수하고
-- REFERENCES/TRIGGER/TRUNCATE/MAINTAIN을 놓친 것을 교정.
-- default ACL이 CREATE TABLE 시점에 자동 부여한 잔존 권한 제거.
--
-- Root cause (confirmed via read-only pg_catalog/pg_default_acl queries
-- against the linked project, ref: tyeszvzncvjjefynerqm):
--   1. This project's pg_default_acl for public/tables (defaclrole=postgres
--      and defaclrole=supabase_admin) grants anon the full privilege set
--      (arwdDxtm = SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/
--      MAINTAIN) automatically on every CREATE TABLE. This is a
--      platform-level default, not set by any migration file in this repo.
--   2. lectures, todos, work_tasks, sms_history, lecture_contact_logs, and
--      instructor_profile (created by repair_lectures_schema.sql and
--      20260629000100_add_lecture_contact_logs.sql) each received the full
--      anon grant at creation time via that default.
--   3. 20260809000100_remove_anon_grants_dedupe_contact_fk.sql later revoked
--      only SELECT/INSERT/UPDATE/DELETE from anon on those 6 tables --
--      never REFERENCES/TRIGGER/TRUNCATE/MAINTAIN. Its companion verify
--      script (20260809000200_verify_anon_grants_contact_fk.sql) only
--      checked those same 4 CRUD commands, so the gap was never caught.
--
-- message_drafts는 대상에서 제외: 생성 마이그레이션
-- (20260728000100_add_message_drafts.sql)이 테이블 생성 직후
-- `REVOKE ALL ON TABLE public.message_drafts FROM anon;`을 이미 실행해
-- 두었으므로 이미 정상 상태(REVOKE ALL 기적용)이다. 나머지 6개 테이블만
-- 대상으로 삼는 이유가 바로 이것이다.
--
-- Idempotent: REVOKE on a privilege the grantee does not hold is a
-- no-op in PostgreSQL (no IF EXISTS needed), matching the style of
-- 20260817000000_baseline_current_state.sql line 415.
--
-- NOT executed as part of this change; requires separate review and a
-- manual `supabase db push` (or equivalent) after approval.

BEGIN;

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'lectures', 'todos', 'work_tasks', 'sms_history',
    'lecture_contact_logs', 'instructor_profile'
  ] LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', target_table);
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- Rollback (manual only -- NOT executed automatically by this file):
--
-- To restore the pre-migration state (anon holding
-- MAINTAIN/REFERENCES/TRIGGER/TRUNCATE on these 6 tables), run:
--
--   GRANT REFERENCES, TRIGGER, TRUNCATE, MAINTAIN
--   ON TABLE public.lectures, public.todos, public.work_tasks,
--            public.sms_history, public.lecture_contact_logs,
--            public.instructor_profile
--   TO anon;
--
-- Note: this restores only the 4 non-CRUD privileges this migration
-- removes. It does NOT restore SELECT/INSERT/UPDATE/DELETE, which were
-- already revoked by 20260809000100 and remain out of scope here.
-- ============================================================================
