BEGIN;

ALTER TABLE public.message_drafts
  ADD COLUMN IF NOT EXISTS is_cleared boolean NOT NULL DEFAULT false;

COMMIT;
