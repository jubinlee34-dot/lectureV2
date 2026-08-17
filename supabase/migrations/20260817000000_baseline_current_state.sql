-- Baseline migration: captures the CURRENT production schema state (public schema)
-- as of 2026-08-17, reconstructed from read-only pg_catalog / information_schema
-- queries against the linked project (ref: tyeszvzncvjjefynerqm), NOT from
-- `supabase db dump` (Docker was unavailable in the authoring environment).
--
-- Why this file exists:
--   `supabase_migrations.schema_migrations` does not exist on the remote database,
--   so the CLI cannot tell which of the 16 existing files under supabase/migrations/
--   were ever applied. Replaying those 16 files in order against a fresh database
--   is also NOT reliable (20260716_02 never drops the anon_all_* policies created by
--   repair_lectures_schema.sql / 20260629000100, which makes the precondition check
--   in 20260809000100 fail on a from-scratch replay). This file is a single
--   ground-truth snapshot of what is actually running in production right now, meant
--   to become the new starting point once the team decides how to handle the old
--   16 files (see migration handling notes shared separately).
--
-- Scope: public schema only. Does not touch auth.* (provided by the Supabase
-- platform) and does not insert/modify any data.
--
-- Legacy columns on public.lectures are intentionally KEPT AS-IS in this baseline:
--   - "placeName", "placeX", "placeY" (text): still read as a fallback in
--     client/src/contexts/SupabaseContext.tsx normalizeLecture() via
--     `row.locationName ?? row.placeName` etc. Not safe to drop without a
--     verified full backfill + a follow-up client code change.
--   - travel_distance_km, travel_duration_min, travel_updated_at (text): no
--     references found anywhere in client/, server/, or api/ (only the
--     camelCase travelDistanceKm/travelDurationMin/travelUpdatedAt columns are
--     used). Appear to be dead columns, but left untouched here since dropping
--     columns is a separate, deliberate decision, not a baseline concern.
--
-- work_tasks_lecture_stage_text_unique is intentionally kept as a plain
-- UNIQUE INDEX (not a named UNIQUE CONSTRAINT), matching what is actually on
-- the remote database today (it was created via a pre-CLI root script,
-- supabase_migration_route_cache_and_work_task_unique.sql, using
-- `CREATE UNIQUE INDEX IF NOT EXISTS`, never via ALTER TABLE ADD CONSTRAINT).
-- No app code (`.upsert(`, `onConflict`) references this name, so an index is
-- sufficient; there is no functional need to convert it into a constraint.
--
-- Idempotent by design (IF NOT EXISTS / DROP ... IF EXISTS + CREATE), matching
-- the style of the existing files in this directory. NOT executed as part of
-- this change; do not run via `supabase db push` without a separate review.

BEGIN;

-- ============================================================================
-- 1. Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.lectures (
  id text PRIMARY KEY,
  organization text DEFAULT '',
  title text DEFAULT '',
  topic text DEFAULT '',
  target text DEFAULT '',
  date text DEFAULT '',
  duration text DEFAULT '',
  participants integer DEFAULT 0,
  location text DEFAULT '',
  content text DEFAULT '',
  reflection text DEFAULT '',
  "managerName" text DEFAULT '',
  "managerPhone" text DEFAULT '',
  fee bigint DEFAULT 0,
  "paymentStatus" text DEFAULT 'unpaid',
  "paidAmount" bigint DEFAULT 0,
  "workflowStage" text DEFAULT 'before',
  "participantReaction" text DEFAULT '',
  "instructorMemo" text DEFAULT '',
  "memorableQuestion" text DEFAULT '',
  "createdAt" text DEFAULT now()::text,
  "travelDistanceKm" numeric,
  "travelDurationMin" integer,
  "travelUpdatedAt" text,
  -- Legacy/unconfirmed-origin columns (see header comment). Kept as-is.
  travel_distance_km text,
  travel_duration_min text,
  travel_updated_at text,
  "jibunAddress" text,
  "roadAddress" text,
  "placeName" text,
  "placeX" text,
  "placeY" text,
  "locationName" text,
  "locationX" text,
  "locationY" text,
  "startTime" text,
  "endTime" text,
  "placeMemo" text,
  "preparationItems" text,
  "requestMemo" text,
  "actualParticipants" integer,
  "paymentDate" text,
  "reportSubmitted" boolean DEFAULT false,
  "reportSubmittedAt" text,
  "satisfactionMemo" text,
  "improvementMemo" text,
  "blogWritten" boolean DEFAULT false,
  "blogUrl" text,
  "afterMemo" text,
  "updatedAt" text,
  user_id uuid NOT NULL DEFAULT auth.uid()
);

CREATE TABLE IF NOT EXISTS public.todos (
  id text PRIMARY KEY,
  "lectureId" text,
  text text DEFAULT '',
  done boolean DEFAULT false,
  priority text DEFAULT 'medium',
  "dueDate" text,
  "createdAt" text DEFAULT now()::text,
  user_id uuid NOT NULL DEFAULT auth.uid()
);

CREATE TABLE IF NOT EXISTS public.work_tasks (
  id text PRIMARY KEY,
  "lectureId" text,
  stage text DEFAULT 'before',
  category text DEFAULT 'other',
  text text DEFAULT '',
  done boolean DEFAULT false,
  "doneAt" text,
  "createdAt" text DEFAULT now()::text,
  starred boolean DEFAULT false,
  user_id uuid NOT NULL DEFAULT auth.uid()
);

CREATE TABLE IF NOT EXISTS public.sms_history (
  id text PRIMARY KEY,
  "lectureId" text,
  type text DEFAULT 'custom',
  recipient text DEFAULT '',
  content text DEFAULT '',
  "sentAt" text DEFAULT now()::text,
  user_id uuid NOT NULL DEFAULT auth.uid()
);

CREATE TABLE IF NOT EXISTS public.lecture_contact_logs (
  id text PRIMARY KEY,
  "lectureId" text,
  channel text DEFAULT 'other',
  topic text DEFAULT 'general',
  title text DEFAULT '',
  content text DEFAULT '',
  "contactName" text DEFAULT '',
  "contactValue" text DEFAULT '',
  important boolean DEFAULT false,
  "occurredAt" text DEFAULT now()::text,
  "createdAt" text DEFAULT now()::text,
  "updatedAt" text,
  user_id uuid NOT NULL DEFAULT auth.uid()
);

CREATE TABLE IF NOT EXISTS public.instructor_profile (
  id text PRIMARY KEY DEFAULT 'default',
  name text DEFAULT '',
  "homeAddress" text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  "customFields" jsonb DEFAULT '[]'::jsonb,
  user_id uuid NOT NULL DEFAULT auth.uid()
);

CREATE TABLE IF NOT EXISTS public.message_drafts (
  id text NOT NULL,
  lecture_id text NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  message_type text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_cleared boolean NOT NULL DEFAULT false
);

-- ============================================================================
-- 2. Constraints (PK / FK / UNIQUE / CHECK)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lectures_user_id_fkey' AND conrelid = 'public.lectures'::regclass
  ) THEN
    ALTER TABLE public.lectures
      ADD CONSTRAINT lectures_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lectures_id_user_id_key' AND conrelid = 'public.lectures'::regclass
  ) THEN
    ALTER TABLE public.lectures
      ADD CONSTRAINT lectures_id_user_id_key UNIQUE (id, user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'todos_lectureId_fkey' AND conrelid = 'public.todos'::regclass
  ) THEN
    ALTER TABLE public.todos
      ADD CONSTRAINT "todos_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES public.lectures(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'todos_user_id_fkey' AND conrelid = 'public.todos'::regclass
  ) THEN
    ALTER TABLE public.todos
      ADD CONSTRAINT todos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'work_tasks_lectureId_fkey' AND conrelid = 'public.work_tasks'::regclass
  ) THEN
    ALTER TABLE public.work_tasks
      ADD CONSTRAINT "work_tasks_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES public.lectures(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'work_tasks_user_id_fkey' AND conrelid = 'public.work_tasks'::regclass
  ) THEN
    ALTER TABLE public.work_tasks
      ADD CONSTRAINT work_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sms_history_lectureId_fkey' AND conrelid = 'public.sms_history'::regclass
  ) THEN
    ALTER TABLE public.sms_history
      ADD CONSTRAINT "sms_history_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES public.lectures(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sms_history_user_id_fkey' AND conrelid = 'public.sms_history'::regclass
  ) THEN
    ALTER TABLE public.sms_history
      ADD CONSTRAINT sms_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lecture_contact_logs_lecture_id_fkey' AND conrelid = 'public.lecture_contact_logs'::regclass
  ) THEN
    ALTER TABLE public.lecture_contact_logs
      ADD CONSTRAINT lecture_contact_logs_lecture_id_fkey FOREIGN KEY ("lectureId") REFERENCES public.lectures(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lecture_contact_logs_user_id_fkey' AND conrelid = 'public.lecture_contact_logs'::regclass
  ) THEN
    ALTER TABLE public.lecture_contact_logs
      ADD CONSTRAINT lecture_contact_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'instructor_profile_user_id_fkey' AND conrelid = 'public.instructor_profile'::regclass
  ) THEN
    ALTER TABLE public.instructor_profile
      ADD CONSTRAINT instructor_profile_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'message_drafts_user_id_fkey' AND conrelid = 'public.message_drafts'::regclass
  ) THEN
    ALTER TABLE public.message_drafts
      ADD CONSTRAINT message_drafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'message_drafts_message_type_check' AND conrelid = 'public.message_drafts'::regclass
  ) THEN
    ALTER TABLE public.message_drafts
      ADD CONSTRAINT message_drafts_message_type_check CHECK (message_type IN ('reminder', 'confirm', 'thankyou', 'custom'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'message_drafts_user_lecture_type_key' AND conrelid = 'public.message_drafts'::regclass
  ) THEN
    ALTER TABLE public.message_drafts
      ADD CONSTRAINT message_drafts_user_lecture_type_key UNIQUE (user_id, lecture_id, message_type);
  END IF;

  -- Depends on lectures_id_user_id_key existing first (composite FK target).
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'message_drafts_lecture_owner_fkey' AND conrelid = 'public.message_drafts'::regclass
  ) THEN
    ALTER TABLE public.message_drafts
      ADD CONSTRAINT message_drafts_lecture_owner_fkey
      FOREIGN KEY (lecture_id, user_id) REFERENCES public.lectures(id, user_id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 3. Indexes (non-constraint-backed only; PK/UNIQUE constraints above already
--    create their backing indexes implicitly)
-- ============================================================================

CREATE INDEX IF NOT EXISTS lectures_created_at_idx ON public.lectures ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS lectures_user_id_idx ON public.lectures (user_id);

CREATE INDEX IF NOT EXISTS todos_created_at_idx ON public.todos ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS todos_lecture_id_idx ON public.todos ("lectureId");
CREATE INDEX IF NOT EXISTS todos_user_id_idx ON public.todos (user_id);

CREATE INDEX IF NOT EXISTS work_tasks_lecture_id_idx ON public.work_tasks ("lectureId");
-- Plain unique index, not a named constraint -- matches remote reality (see header comment).
CREATE UNIQUE INDEX IF NOT EXISTS work_tasks_lecture_stage_text_unique ON public.work_tasks ("lectureId", stage, text);
CREATE INDEX IF NOT EXISTS work_tasks_user_id_idx ON public.work_tasks (user_id);

CREATE INDEX IF NOT EXISTS sms_history_sent_at_idx ON public.sms_history ("sentAt" DESC);
CREATE INDEX IF NOT EXISTS sms_history_lecture_id_idx ON public.sms_history ("lectureId");
CREATE INDEX IF NOT EXISTS sms_history_user_id_idx ON public.sms_history (user_id);

CREATE INDEX IF NOT EXISTS lecture_contact_logs_lecture_id_idx ON public.lecture_contact_logs ("lectureId");
CREATE INDEX IF NOT EXISTS lecture_contact_logs_occurred_at_idx ON public.lecture_contact_logs ("occurredAt" DESC);
CREATE INDEX IF NOT EXISTS lecture_contact_logs_important_idx ON public.lecture_contact_logs (important);
CREATE INDEX IF NOT EXISTS lecture_contact_logs_user_id_idx ON public.lecture_contact_logs (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS instructor_profile_user_id_unique ON public.instructor_profile (user_id);

-- ============================================================================
-- 4. Function + trigger (message_drafts.updated_at maintenance)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_message_drafts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS message_drafts_set_updated_at ON public.message_drafts;
CREATE TRIGGER message_drafts_set_updated_at
  BEFORE UPDATE ON public.message_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_message_drafts_updated_at();

-- ============================================================================
-- 5. Row Level Security
-- ============================================================================

ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lecture_contact_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_drafts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. Policies (28 total: 7 tables x 4 owner-based policies for `authenticated`)
-- ============================================================================

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'lectures', 'todos', 'work_tasks', 'sms_history',
    'lecture_contact_logs', 'instructor_profile', 'message_drafts'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', format('Users can select own %s', target_table), target_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', format('Users can insert own %s', target_table), target_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', format('Users can update own %s', target_table), target_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', format('Users can delete own %s', target_table), target_table);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((select auth.uid()) = user_id)',
      format('Users can select own %s', target_table), target_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id)',
      format('Users can insert own %s', target_table), target_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id)',
      format('Users can update own %s', target_table), target_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING ((select auth.uid()) = user_id)',
      format('Users can delete own %s', target_table), target_table
    );
  END LOOP;
END $$;

-- ============================================================================
-- 7. Grants (anon has no CRUD access; authenticated has full CRUD, RLS-scoped)
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'lectures', 'todos', 'work_tasks', 'sms_history',
    'lecture_contact_logs', 'instructor_profile', 'message_drafts'
  ] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', target_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', target_table);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
