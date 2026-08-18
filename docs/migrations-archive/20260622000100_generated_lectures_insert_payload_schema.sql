-- Generated from the current lectures insert payload in client/src/contexts/SupabaseContext.tsx.
-- Source of truth: LECTURE_DB_COLUMNS / Lecture / LectureFormData.
-- Safe to run multiple times in the Supabase SQL Editor.

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

COMMENT ON TABLE public.lectures IS
  'Schema aligned with current React/TypeScript lectures insert payload.';

COMMENT ON COLUMN public.lectures."locationName" IS
  'Internal place metadata saved from address/place search. Not directly user-edited.';
COMMENT ON COLUMN public.lectures."locationX" IS
  'Internal place longitude/x coordinate saved from address/place search. Not directly user-edited.';
COMMENT ON COLUMN public.lectures."locationY" IS
  'Internal place latitude/y coordinate saved from address/place search. Not directly user-edited.';

-- Backfill current place columns from older experimental names if they still exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lectures' AND column_name = 'placeName'
  ) THEN
    EXECUTE 'UPDATE public.lectures
      SET "locationName" = COALESCE(NULLIF("locationName", ''''), "placeName")
      WHERE "placeName" IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lectures' AND column_name = 'placeX'
  ) THEN
    EXECUTE 'UPDATE public.lectures
      SET "locationX" = COALESCE(NULLIF("locationX", ''''), "placeX")
      WHERE "placeX" IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lectures' AND column_name = 'placeY'
  ) THEN
    EXECUTE 'UPDATE public.lectures
      SET "locationY" = COALESCE(NULLIF("locationY", ''''), "placeY")
      WHERE "placeY" IS NOT NULL';
  END IF;
END $$;

-- Backfill current route cache columns from older snake_case columns if they still exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lectures' AND column_name = 'travel_distance_km'
  ) THEN
    EXECUTE 'UPDATE public.lectures
      SET "travelDistanceKm" = COALESCE(
        "travelDistanceKm",
        NULLIF(regexp_replace(travel_distance_km::text, ''[^0-9.]'', '''', ''g''), '''')::numeric
      )
      WHERE "travelDistanceKm" IS NULL AND travel_distance_km IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lectures' AND column_name = 'travel_duration_min'
  ) THEN
    EXECUTE 'UPDATE public.lectures
      SET "travelDurationMin" = COALESCE(
        "travelDurationMin",
        NULLIF(regexp_replace(travel_duration_min::text, ''[^0-9]'', '''', ''g''), '''')::integer
      )
      WHERE "travelDurationMin" IS NULL AND travel_duration_min IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lectures' AND column_name = 'travel_updated_at'
  ) THEN
    EXECUTE 'UPDATE public.lectures
      SET "travelUpdatedAt" = COALESCE("travelUpdatedAt", travel_updated_at::text)
      WHERE "travelUpdatedAt" IS NULL AND travel_updated_at IS NOT NULL';
  END IF;
END $$;

-- Drop candidates for a later manual migration after data verification:
-- public.lectures."placeName"
-- public.lectures."placeX"
-- public.lectures."placeY"
-- public.lectures.travel_distance_km
-- public.lectures.travel_duration_min
-- public.lectures.travel_updated_at

CREATE INDEX IF NOT EXISTS lectures_created_at_idx ON public.lectures ("createdAt" DESC);

ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lectures TO anon;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'lectures'
      AND policyname = 'anon_all_lectures'
  ) THEN
    CREATE POLICY anon_all_lectures
      ON public.lectures
      FOR ALL
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
