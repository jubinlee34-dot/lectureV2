-- Lecture Archive V2 Supabase schema migration
-- Run this whole file in Supabase SQL Editor.

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
  "travelUpdatedAt" text,
  travel_distance_km text,
  travel_duration_min text,
  travel_updated_at text
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

-- Make the migration safe for databases where tables already exist but are missing columns.
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
  ADD COLUMN IF NOT EXISTS "travelUpdatedAt" text,
  ADD COLUMN IF NOT EXISTS travel_distance_km text,
  ADD COLUMN IF NOT EXISTS travel_duration_min text,
  ADD COLUMN IF NOT EXISTS travel_updated_at text;

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

-- Backfill current route cache columns from older snake_case cache columns if old data exists.
UPDATE public.lectures
SET
  "travelDistanceKm" = COALESCE(
    "travelDistanceKm",
    NULLIF(regexp_replace(travel_distance_km, '[^0-9.]', '', 'g'), '')::numeric
  ),
  "travelDurationMin" = COALESCE(
    "travelDurationMin",
    NULLIF(regexp_replace(travel_duration_min, '[^0-9]', '', 'g'), '')::integer
  ),
  "travelUpdatedAt" = COALESCE("travelUpdatedAt", travel_updated_at)
WHERE
  ("travelDistanceKm" IS NULL AND travel_distance_km IS NOT NULL)
  OR ("travelDurationMin" IS NULL AND travel_duration_min IS NOT NULL)
  OR ("travelUpdatedAt" IS NULL AND travel_updated_at IS NOT NULL);

-- Remove duplicate work task rows before adding the uniqueness guard.
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

CREATE UNIQUE INDEX IF NOT EXISTS work_tasks_lecture_stage_text_unique
  ON public.work_tasks ("lectureId", stage, text);

CREATE INDEX IF NOT EXISTS lectures_created_at_idx
  ON public.lectures ("createdAt" DESC);

CREATE INDEX IF NOT EXISTS todos_created_at_idx
  ON public.todos ("createdAt" DESC);

CREATE INDEX IF NOT EXISTS todos_lecture_id_idx
  ON public.todos ("lectureId");

CREATE INDEX IF NOT EXISTS work_tasks_lecture_id_idx
  ON public.work_tasks ("lectureId");

CREATE INDEX IF NOT EXISTS sms_history_sent_at_idx
  ON public.sms_history ("sentAt" DESC);

CREATE INDEX IF NOT EXISTS sms_history_lecture_id_idx
  ON public.sms_history ("lectureId");

-- The current app uses the public anon client directly, so RLS is disabled.
-- Re-enable RLS only after adding user/auth ownership columns and policies.
ALTER TABLE public.lectures DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.todos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_profile DISABLE ROW LEVEL SECURITY;

INSERT INTO public.instructor_profile (
  id,
  name,
  "homeAddress",
  phone,
  email,
  "customFields"
)
VALUES (
  'default',
  '',
  '',
  '',
  '',
  '[]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
