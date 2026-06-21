-- Backfill route cache values from unused snake_case columns into the current camelCase columns.
-- Current TypeScript code uses only:
--   "travelDistanceKm", "travelDurationMin", "travelUpdatedAt"
-- The snake_case columns below are legacy/unused candidates and are intentionally not dropped here:
--   travel_distance_km, travel_duration_min, travel_updated_at

BEGIN;

ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS "travelDistanceKm" numeric,
  ADD COLUMN IF NOT EXISTS "travelDurationMin" integer,
  ADD COLUMN IF NOT EXISTS "travelUpdatedAt" text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lectures'
      AND column_name = 'travel_distance_km'
  ) THEN
    EXECUTE 'UPDATE public.lectures
      SET "travelDistanceKm" = NULLIF(regexp_replace(travel_distance_km::text, ''[^0-9.]'', '''', ''g''), '''')::numeric
      WHERE "travelDistanceKm" IS NULL
        AND travel_distance_km IS NOT NULL
        AND NULLIF(regexp_replace(travel_distance_km::text, ''[^0-9.]'', '''', ''g''), '''') IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lectures'
      AND column_name = 'travel_duration_min'
  ) THEN
    EXECUTE 'UPDATE public.lectures
      SET "travelDurationMin" =
        CASE
          WHEN travel_duration_min::text LIKE ''%시간%'' THEN
            COALESCE(NULLIF(substring(travel_duration_min::text FROM ''([0-9]+)\s*시간''), '''')::integer, 0) * 60
            + COALESCE(NULLIF(substring(travel_duration_min::text FROM ''([0-9]+)\s*분''), '''')::integer, 0)
          ELSE NULLIF(regexp_replace(travel_duration_min::text, ''[^0-9]'', '''', ''g''), '''')::integer
        END
      WHERE "travelDurationMin" IS NULL
        AND travel_duration_min IS NOT NULL
        AND NULLIF(regexp_replace(travel_duration_min::text, ''[^0-9]'', '''', ''g''), '''') IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lectures'
      AND column_name = 'travel_updated_at'
  ) THEN
    EXECUTE 'UPDATE public.lectures
      SET "travelUpdatedAt" = travel_updated_at::text
      WHERE "travelUpdatedAt" IS NULL
        AND travel_updated_at IS NOT NULL';
  END IF;
END $$;

COMMENT ON COLUMN public.lectures."travelDistanceKm" IS
  'Current route distance cache column used by TypeScript. Legacy travel_distance_km is an unused drop candidate after verification.';
COMMENT ON COLUMN public.lectures."travelDurationMin" IS
  'Current route duration cache column used by TypeScript. Legacy travel_duration_min is an unused drop candidate after verification.';
COMMENT ON COLUMN public.lectures."travelUpdatedAt" IS
  'Current route cache freshness column used by TypeScript. Legacy travel_updated_at is an unused drop candidate after verification.';

NOTIFY pgrst, 'reload schema';

COMMIT;
