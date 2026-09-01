-- Adds soft-delete support to public.lectures for the 30-day lecture trash.
--
-- Design (P0-5A, option 3: parent-only soft delete, children filtered by the
-- parent's state):
--
--   * Only `lectures` gains `deleted_at`. The five child tables (todos,
--     work_tasks, sms_history, lecture_contact_logs, message_drafts) are left
--     exactly as they are, so their existing ON DELETE CASCADE foreign keys
--     stay intact. Permanent deletion therefore remains a single DELETE on the
--     parent and reuses the cascade that is already in place -- no new purge
--     path, and no soft-delete columns competing with the existing UNIQUE
--     constraints on work_tasks (lectureId, stage, text) and message_drafts
--     (user_id, lecture_id, message_type).
--
--   * No new table is created here, so the pg_default_acl / anon REVOKE
--     safeguards in docs/supabase-db-operations.md do not apply to this
--     change. The existing RLS policies on public.lectures already cover the
--     new column: they are row-scoped ((select auth.uid()) = user_id), not
--     column-scoped.
--
--   * `authenticated` already holds UPDATE on public.lectures (granted in
--     20260817000000_baseline_current_state.sql), so soft delete and restore
--     need no additional grants.
--
-- Retention: rows are purged 30 days after `deleted_at`. The purge runs from
-- the client on load rather than pg_cron, so no scheduler extension is needed.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS, matching
-- the style of the existing migrations in this directory.

BEGIN;

ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN public.lectures.deleted_at IS
  'Soft delete timestamp. NULL = active. Non-NULL = in trash, purged 30 days after this timestamp.';

-- Hot path: every load reads active lectures for one owner, newest first.
CREATE INDEX IF NOT EXISTS lectures_active_user_created_idx
  ON public.lectures (user_id, "createdAt" DESC)
  WHERE deleted_at IS NULL;

-- Trash listing and the 30-day purge both scan by deleted_at.
CREATE INDEX IF NOT EXISTS lectures_trash_user_deleted_idx
  ON public.lectures (user_id, deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
