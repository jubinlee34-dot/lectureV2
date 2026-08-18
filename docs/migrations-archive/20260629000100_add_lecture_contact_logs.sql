-- Add per-lecture pre-contact logs without mixing them into lecture memo fields.

BEGIN;

CREATE TABLE IF NOT EXISTS public.lecture_contact_logs (
  id text PRIMARY KEY,
  "lectureId" text REFERENCES public.lectures(id) ON DELETE CASCADE,
  channel text DEFAULT 'other',
  topic text DEFAULT 'general',
  title text DEFAULT '',
  content text DEFAULT '',
  "contactName" text DEFAULT '',
  "contactValue" text DEFAULT '',
  important boolean DEFAULT false,
  "occurredAt" text DEFAULT now()::text,
  "createdAt" text DEFAULT now()::text,
  "updatedAt" text
);

ALTER TABLE public.lecture_contact_logs
  ADD COLUMN IF NOT EXISTS "lectureId" text,
  ADD COLUMN IF NOT EXISTS channel text DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS topic text DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS title text DEFAULT '',
  ADD COLUMN IF NOT EXISTS content text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "contactName" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS "contactValue" text DEFAULT '',
  ADD COLUMN IF NOT EXISTS important boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "occurredAt" text DEFAULT now()::text,
  ADD COLUMN IF NOT EXISTS "createdAt" text DEFAULT now()::text,
  ADD COLUMN IF NOT EXISTS "updatedAt" text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lecture_contact_logs_lecture_id_fkey'
      AND conrelid = 'public.lecture_contact_logs'::regclass
  ) THEN
    ALTER TABLE public.lecture_contact_logs
      ADD CONSTRAINT lecture_contact_logs_lecture_id_fkey
      FOREIGN KEY ("lectureId") REFERENCES public.lectures(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS lecture_contact_logs_lecture_id_idx ON public.lecture_contact_logs ("lectureId");
CREATE INDEX IF NOT EXISTS lecture_contact_logs_occurred_at_idx ON public.lecture_contact_logs ("occurredAt" DESC);
CREATE INDEX IF NOT EXISTS lecture_contact_logs_important_idx ON public.lecture_contact_logs (important);

ALTER TABLE public.lecture_contact_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lecture_contact_logs TO anon;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lecture_contact_logs' AND policyname = 'anon_all_lecture_contact_logs') THEN
    CREATE POLICY anon_all_lecture_contact_logs ON public.lecture_contact_logs FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
