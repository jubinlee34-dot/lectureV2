-- Session B: split lecture registration from after-lecture records.
-- Safe to run multiple times. Adds nullable/defaulted columns only.

BEGIN;

ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS "startTime" text,
  ADD COLUMN IF NOT EXISTS "endTime" text,
  ADD COLUMN IF NOT EXISTS "placeMemo" text,
  ADD COLUMN IF NOT EXISTS "preparationItems" text,
  ADD COLUMN IF NOT EXISTS "requestMemo" text,
  ADD COLUMN IF NOT EXISTS "actualParticipants" integer,
  ADD COLUMN IF NOT EXISTS "paymentDate" text,
  ADD COLUMN IF NOT EXISTS "reportSubmitted" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reportSubmittedAt" text,
  ADD COLUMN IF NOT EXISTS "satisfactionMemo" text,
  ADD COLUMN IF NOT EXISTS "improvementMemo" text,
  ADD COLUMN IF NOT EXISTS "blogWritten" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "blogUrl" text,
  ADD COLUMN IF NOT EXISTS "afterMemo" text,
  ADD COLUMN IF NOT EXISTS "updatedAt" text;

COMMENT ON COLUMN public.lectures."startTime" IS
  'Session B optional start time. Existing duration remains for backward compatibility.';
COMMENT ON COLUMN public.lectures."endTime" IS
  'Session B optional end time. Existing duration remains for backward compatibility.';
COMMENT ON COLUMN public.lectures."actualParticipants" IS
  'Actual participant count recorded after the lecture.';
COMMENT ON COLUMN public.lectures."afterMemo" IS
  'Freeform after-lecture memo captured from the shared AfterRecordModal.';

COMMIT;
