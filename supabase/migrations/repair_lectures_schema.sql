-- Repair Lecture Archive V2 schema to match the current React/TypeScript code.
-- Safe to run multiple times in Supabase SQL Editor.

BEGIN;

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
  "locationName" text DEFAULT '',
  "roadAddress" text DEFAULT '',
  "jibunAddress" text DEFAULT '',
  "locationX" text DEFAULT '',
  "locationY" text DEFAULT '',
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
  "travelUpdatedAt" text
);

CREATE TABLE IF NOT EXISTS public.todos (
  id text PRIMARY KEY,
  "lectureId" text REFERENCES public.lectures(id) ON DELETE CASCADE,
  text text DEFAULT '',
  done boolean DEFAULT false,
  priority text DEFAULT 'medium',
  "dueDate" text,
  "createdAt" text DEFAULT now()::text
);

CREATE TABLE IF NOT EXISTS public.work_tasks (
  id text PRIMARY KEY,
  "lectureId" text REFERENCES public.lectures(id) ON DELETE CASCADE,
  stage text DEFAULT 'before',
  category text DEFAULT 'other',
  text text DEFAULT '',
  done boolean DEFAULT false,
  "doneAt" text,
  "createdAt" text DEFAULT now()::text,
  starred boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.sms_history (
  id text PRIMARY KEY,
  "lectureId" text REFERENCES public.lectures(id) ON DELETE CASCADE,
  type text DEFAULT 'custom',
  recipient text DEFAULT '',
  content text DEFAULT '',
  "sentAt" text DEFAULT now()::text
);

CREATE TABLE IF NOT EXISTS public.instructor_profile (
  id text PRIMARY KEY DEFAULT 'default',
  name text DEFAULT '',
  "homeAddress" text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  "customFields" jsonb DEFAULT '[]'::jsonb
);

ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS organization text DEFAULT '',
  ADD COLUMN IF NOT EXISTS title text DEFAULT '',
  ADD COLUMN IF NOT EXISTS topic text DEFAULT '',
  ADD COLUMN IF NOT EXISTS target text DEFAULT '',
  ADD COLUMN IF NOT EXISTS date text DEFAULT '',
  ADD COLUMN IF NOT EXISTS duration text DEFAULT '',
  ADD COLUMN IF NOT EXISTS participants integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS location text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "locationName" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "roadAddress" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "jibunAddress" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "locationX" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "locationY" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS content text DEFAULT '',
  ADD COLUMN IF NOT EXISTS reflection text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "managerName" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "managerPhone" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS fee bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "paymentStatus" text DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS "paidAmount" bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "workflowStage" text DEFAULT 'before',
  ADD COLUMN IF NOT EXISTS "participantReaction" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "instructorMemo" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "memorableQuestion" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "createdAt" text DEFAULT now()::text,
  ADD COLUMN IF NOT EXISTS "travelDistanceKm" numeric,
  ADD COLUMN IF NOT EXISTS "travelDurationMin" integer,
  ADD COLUMN IF NOT EXISTS "travelUpdatedAt" text;

ALTER TABLE public.todos
  ADD COLUMN IF NOT EXISTS "lectureId" text,
  ADD COLUMN IF NOT EXISTS text text DEFAULT '',
  ADD COLUMN IF NOT EXISTS done boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS "dueDate" text,
  ADD COLUMN IF NOT EXISTS "createdAt" text DEFAULT now()::text;

ALTER TABLE public.work_tasks
  ADD COLUMN IF NOT EXISTS "lectureId" text,
  ADD COLUMN IF NOT EXISTS stage text DEFAULT 'before',
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS text text DEFAULT '',
  ADD COLUMN IF NOT EXISTS done boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "doneAt" text,
  ADD COLUMN IF NOT EXISTS "createdAt" text DEFAULT now()::text,
  ADD COLUMN IF NOT EXISTS starred boolean DEFAULT false;

ALTER TABLE public.sms_history
  ADD COLUMN IF NOT EXISTS "lectureId" text,
  ADD COLUMN IF NOT EXISTS type text DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS recipient text DEFAULT '',
  ADD COLUMN IF NOT EXISTS content text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "sentAt" text DEFAULT now()::text;

ALTER TABLE public.instructor_profile
  ADD COLUMN IF NOT EXISTS name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "homeAddress" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone text DEFAULT '',
  ADD COLUMN IF NOT EXISTS email text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "customFields" jsonb DEFAULT '[]'::jsonb;

-- Backfill current Kakao place columns from earlier experimental names when present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lectures' AND column_name = 'placeName'
  ) THEN
    EXECUTE 'UPDATE public.lectures SET "locationName" = COALESCE(NULLIF("locationName", ''''), "placeName") WHERE "placeName" IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lectures' AND column_name = 'placeX'
  ) THEN
    EXECUTE 'UPDATE public.lectures SET "locationX" = COALESCE(NULLIF("locationX", ''''), "placeX") WHERE "placeX" IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lectures' AND column_name = 'placeY'
  ) THEN
    EXECUTE 'UPDATE public.lectures SET "locationY" = COALESCE(NULLIF("locationY", ''''), "placeY") WHERE "placeY" IS NOT NULL';
  END IF;
END $$;

-- Backfill current route cache columns from older snake_case route cache columns when present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lectures' AND column_name = 'travel_distance_km'
  ) THEN
    EXECUTE 'UPDATE public.lectures SET "travelDistanceKm" = COALESCE("travelDistanceKm", NULLIF(regexp_replace(travel_distance_km, ''[^0-9.]'', '''', ''g''), '''')::numeric) WHERE "travelDistanceKm" IS NULL AND travel_distance_km IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lectures' AND column_name = 'travel_duration_min'
  ) THEN
    EXECUTE 'UPDATE public.lectures SET "travelDurationMin" = COALESCE("travelDurationMin", NULLIF(regexp_replace(travel_duration_min, ''[^0-9]'', '''', ''g''), '''')::integer) WHERE "travelDurationMin" IS NULL AND travel_duration_min IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lectures' AND column_name = 'travel_updated_at'
  ) THEN
    EXECUTE 'UPDATE public.lectures SET "travelUpdatedAt" = COALESCE("travelUpdatedAt", travel_updated_at) WHERE "travelUpdatedAt" IS NULL AND travel_updated_at IS NOT NULL';
  END IF;
END $$;

-- Drop candidates for a separate future migration after data verification:
-- public.lectures.travel_distance_km
-- public.lectures.travel_duration_min
-- public.lectures.travel_updated_at
-- public.lectures."placeName"
-- public.lectures."placeX"
-- public.lectures."placeY"

WITH ranked_work_tasks AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY "lectureId", stage, text
      ORDER BY
        COALESCE(starred, false) DESC,
        COALESCE(done, false) DESC,
        "createdAt" ASC NULLS LAST,
        id ASC
    ) AS row_num
  FROM public.work_tasks
)
DELETE FROM public.work_tasks wt
USING ranked_work_tasks ranked
WHERE wt.id = ranked.id
  AND ranked.row_num > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'work_tasks_lecture_stage_text_unique'
      AND conrelid = 'public.work_tasks'::regclass
  ) THEN
    ALTER TABLE public.work_tasks
      ADD CONSTRAINT work_tasks_lecture_stage_text_unique UNIQUE ("lectureId", stage, text);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS lectures_created_at_idx ON public.lectures ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS todos_created_at_idx ON public.todos ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS todos_lecture_id_idx ON public.todos ("lectureId");
CREATE INDEX IF NOT EXISTS work_tasks_lecture_id_idx ON public.work_tasks ("lectureId");
CREATE INDEX IF NOT EXISTS sms_history_sent_at_idx ON public.sms_history ("sentAt" DESC);
CREATE INDEX IF NOT EXISTS sms_history_lecture_id_idx ON public.sms_history ("lectureId");

INSERT INTO public.instructor_profile (id, name, "homeAddress", phone, email, "customFields")
VALUES ('default', '', '', '', '', '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_profile ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lectures TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.todos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_tasks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_history TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instructor_profile TO anon;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lectures' AND policyname = 'anon_all_lectures') THEN
    CREATE POLICY anon_all_lectures ON public.lectures FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'todos' AND policyname = 'anon_all_todos') THEN
    CREATE POLICY anon_all_todos ON public.todos FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'work_tasks' AND policyname = 'anon_all_work_tasks') THEN
    CREATE POLICY anon_all_work_tasks ON public.work_tasks FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sms_history' AND policyname = 'anon_all_sms_history') THEN
    CREATE POLICY anon_all_sms_history ON public.sms_history FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'instructor_profile' AND policyname = 'anon_all_instructor_profile') THEN
    CREATE POLICY anon_all_instructor_profile ON public.instructor_profile FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
