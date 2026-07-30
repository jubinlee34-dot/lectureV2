BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lectures_id_user_id_key'
      AND conrelid = 'public.lectures'::regclass
  ) THEN
    ALTER TABLE public.lectures
      ADD CONSTRAINT lectures_id_user_id_key UNIQUE (id, user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.message_drafts (
  id text NOT NULL,
  lecture_id text NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  message_type text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_drafts_pkey PRIMARY KEY (id),
  CONSTRAINT message_drafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT message_drafts_message_type_check CHECK (message_type IN ('reminder', 'confirm', 'thankyou', 'custom')),
  CONSTRAINT message_drafts_user_lecture_type_key UNIQUE (user_id, lecture_id, message_type),
  CONSTRAINT message_drafts_lecture_owner_fkey FOREIGN KEY (lecture_id, user_id) REFERENCES public.lectures(id, user_id) ON DELETE CASCADE
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'message_drafts_pkey'
      AND conrelid = 'public.message_drafts'::regclass
  ) THEN
    ALTER TABLE public.message_drafts
      ADD CONSTRAINT message_drafts_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'message_drafts_user_id_fkey'
      AND conrelid = 'public.message_drafts'::regclass
  ) THEN
    ALTER TABLE public.message_drafts
      ADD CONSTRAINT message_drafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'message_drafts_message_type_check'
      AND conrelid = 'public.message_drafts'::regclass
  ) THEN
    ALTER TABLE public.message_drafts
      ADD CONSTRAINT message_drafts_message_type_check CHECK (message_type IN ('reminder', 'confirm', 'thankyou', 'custom'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'message_drafts_user_lecture_type_key'
      AND conrelid = 'public.message_drafts'::regclass
  ) THEN
    ALTER TABLE public.message_drafts
      ADD CONSTRAINT message_drafts_user_lecture_type_key UNIQUE (user_id, lecture_id, message_type);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'message_drafts_lecture_owner_fkey'
      AND conrelid = 'public.message_drafts'::regclass
  ) THEN
    ALTER TABLE public.message_drafts
      ADD CONSTRAINT message_drafts_lecture_owner_fkey
      FOREIGN KEY (lecture_id, user_id) REFERENCES public.lectures(id, user_id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_message_drafts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS message_drafts_set_updated_at ON public.message_drafts;
CREATE TRIGGER message_drafts_set_updated_at
  BEFORE UPDATE ON public.message_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_message_drafts_updated_at();

ALTER TABLE public.message_drafts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.message_drafts FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.message_drafts
TO authenticated;

DROP POLICY IF EXISTS "Users can select own message_drafts" ON public.message_drafts;
DROP POLICY IF EXISTS "Users can insert own message_drafts" ON public.message_drafts;
DROP POLICY IF EXISTS "Users can update own message_drafts" ON public.message_drafts;
DROP POLICY IF EXISTS "Users can delete own message_drafts" ON public.message_drafts;

CREATE POLICY "Users can select own message_drafts"
  ON public.message_drafts
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own message_drafts"
  ON public.message_drafts
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own message_drafts"
  ON public.message_drafts
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own message_drafts"
  ON public.message_drafts
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

COMMIT;