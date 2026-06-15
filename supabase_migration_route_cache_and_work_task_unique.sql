-- Route cache fields for lectures.
ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS "travelDistanceKm" NUMERIC,
  ADD COLUMN IF NOT EXISTS "travelDurationMin" INTEGER,
  ADD COLUMN IF NOT EXISTS "travelUpdatedAt" TEXT;

-- Backfill from legacy text columns if they exist.
UPDATE public.lectures
SET
  "travelDistanceKm" = COALESCE(
    "travelDistanceKm",
    NULLIF(regexp_replace(travel_distance_km, '[^0-9.]', '', 'g'), '')::numeric
  ),
  "travelDurationMin" = COALESCE(
    "travelDurationMin",
    CASE
      WHEN travel_duration_min IS NULL OR travel_duration_min = '' THEN NULL
      WHEN travel_duration_min LIKE '%시간%' THEN
        COALESCE(NULLIF(substring(travel_duration_min FROM '([0-9]+)\s*시간'), '')::integer, 0) * 60
        + COALESCE(NULLIF(substring(travel_duration_min FROM '([0-9]+)\s*분'), '')::integer, 0)
      ELSE NULLIF(regexp_replace(travel_duration_min, '[^0-9]', '', 'g'), '')::integer
    END
  ),
  "travelUpdatedAt" = COALESCE("travelUpdatedAt", travel_updated_at)
WHERE
  ("travelDistanceKm" IS NULL AND travel_distance_km IS NOT NULL)
  OR ("travelDurationMin" IS NULL AND travel_duration_min IS NOT NULL)
  OR ("travelUpdatedAt" IS NULL AND travel_updated_at IS NOT NULL);

-- Remove duplicate work tasks before adding the uniqueness guard.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY "lectureId", stage, text
      ORDER BY
        COALESCE(starred, false) DESC,
        COALESCE(done, false) DESC,
        "createdAt" ASC NULLS LAST,
        id ASC
    ) AS rn
  FROM public.work_tasks
)
DELETE FROM public.work_tasks wt
USING ranked r
WHERE wt.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS work_tasks_lecture_stage_text_unique
  ON public.work_tasks ("lectureId", stage, text);

-- Naver API credentials must live in server environment variables only.
ALTER TABLE public.instructor_profile
  DROP COLUMN IF EXISTS "naverMapClientId",
  DROP COLUMN IF EXISTS "naverMapClientSecret",
  DROP COLUMN IF EXISTS password;
