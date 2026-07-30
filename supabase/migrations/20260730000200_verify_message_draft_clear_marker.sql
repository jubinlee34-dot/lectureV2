BEGIN;

DO $$
DECLARE
  clear_default_expr text;
  policy_count integer;
  owner_condition constant text := 'selectauth.uidasuid=user_id';
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'message_drafts'
      AND column_name = 'is_cleared'
      AND udt_name = 'bool'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'public.message_drafts.is_cleared must exist as boolean NOT NULL.';
  END IF;

  SELECT regexp_replace(
    lower(pg_get_expr(defaults.adbin, defaults.adrelid)),
    '\s+|\(|\)|::boolean',
    '',
    'g'
  )
  INTO clear_default_expr
  FROM pg_attrdef defaults
  JOIN pg_attribute attributes
    ON attributes.attrelid = defaults.adrelid
   AND attributes.attnum = defaults.adnum
  WHERE defaults.adrelid = 'public.message_drafts'::regclass
    AND attributes.attname = 'is_cleared'
    AND NOT attributes.attisdropped;

  IF clear_default_expr IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'public.message_drafts.is_cleared default must be false.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class class
    JOIN pg_namespace namespace ON namespace.oid = class.relnamespace
    WHERE namespace.nspname = 'public'
      AND class.relname = 'message_drafts'
      AND class.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled on public.message_drafts.';
  END IF;

  SELECT count(*)
  INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'message_drafts';

  IF policy_count <> 4 THEN
    RAISE EXCEPTION 'public.message_drafts must retain exactly four RLS policies.';
  END IF;

  SELECT count(*)
  INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'message_drafts'
    AND policyname = 'Users can select own message_drafts'
    AND cmd = 'SELECT'
    AND permissive = 'PERMISSIVE'
    AND roles = ARRAY['authenticated']::name[]
    AND regexp_replace(lower(coalesce(qual, '')), '\s+|\(|\)', '', 'g') = owner_condition
    AND with_check IS NULL;

  IF policy_count <> 1 THEN
    RAISE EXCEPTION 'Missing authenticated SELECT owner policy for public.message_drafts.';
  END IF;

  SELECT count(*)
  INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'message_drafts'
    AND policyname = 'Users can insert own message_drafts'
    AND cmd = 'INSERT'
    AND permissive = 'PERMISSIVE'
    AND roles = ARRAY['authenticated']::name[]
    AND qual IS NULL
    AND regexp_replace(lower(coalesce(with_check, '')), '\s+|\(|\)', '', 'g') = owner_condition;

  IF policy_count <> 1 THEN
    RAISE EXCEPTION 'Missing authenticated INSERT owner policy for public.message_drafts.';
  END IF;

  SELECT count(*)
  INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'message_drafts'
    AND policyname = 'Users can update own message_drafts'
    AND cmd = 'UPDATE'
    AND permissive = 'PERMISSIVE'
    AND roles = ARRAY['authenticated']::name[]
    AND regexp_replace(lower(coalesce(qual, '')), '\s+|\(|\)', '', 'g') = owner_condition
    AND regexp_replace(lower(coalesce(with_check, '')), '\s+|\(|\)', '', 'g') = owner_condition;

  IF policy_count <> 1 THEN
    RAISE EXCEPTION 'Missing authenticated UPDATE owner policy for public.message_drafts.';
  END IF;

  SELECT count(*)
  INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'message_drafts'
    AND policyname = 'Users can delete own message_drafts'
    AND cmd = 'DELETE'
    AND permissive = 'PERMISSIVE'
    AND roles = ARRAY['authenticated']::name[]
    AND regexp_replace(lower(coalesce(qual, '')), '\s+|\(|\)', '', 'g') = owner_condition
    AND with_check IS NULL;

  IF policy_count <> 1 THEN
    RAISE EXCEPTION 'Missing authenticated DELETE owner policy for public.message_drafts.';
  END IF;
END $$;

COMMIT;
