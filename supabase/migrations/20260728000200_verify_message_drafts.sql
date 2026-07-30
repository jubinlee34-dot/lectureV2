BEGIN;

DO $$
DECLARE
  missing_columns text[];
  invalid_columns text[];
  policy_count integer;
  constraint_def text;
  constraint_expr text;
  content_default_expr text;
  owner_condition constant text := 'selectauth.uidasuid=user_id';
BEGIN
  IF to_regclass('public.message_drafts') IS NULL THEN
    RAISE EXCEPTION 'public.message_drafts table does not exist.';
  END IF;

  SELECT coalesce(array_agg(required.column_name ORDER BY required.column_name), ARRAY[]::text[])
  INTO missing_columns
  FROM (VALUES
    ('id'),
    ('lecture_id'),
    ('user_id'),
    ('message_type'),
    ('content'),
    ('created_at'),
    ('updated_at')
  ) AS required(column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns columns
    WHERE columns.table_schema = 'public'
      AND columns.table_name = 'message_drafts'
      AND columns.column_name = required.column_name
  );

  IF cardinality(missing_columns) > 0 THEN
    RAISE EXCEPTION 'Missing public.message_drafts columns: %', array_to_string(missing_columns, ', ');
  END IF;

  SELECT coalesce(array_agg(column_name ORDER BY column_name), ARRAY[]::text[])
  INTO invalid_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'message_drafts'
    AND (
      (column_name = 'id' AND (udt_name <> 'text' OR is_nullable <> 'NO'))
      OR (column_name = 'lecture_id' AND (udt_name <> 'text' OR is_nullable <> 'NO'))
      OR (column_name = 'user_id' AND (udt_name <> 'uuid' OR is_nullable <> 'NO' OR column_default NOT ILIKE '%auth.uid%'))
      OR (column_name = 'message_type' AND (udt_name <> 'text' OR is_nullable <> 'NO'))
      OR (column_name = 'content' AND (udt_name <> 'text' OR is_nullable <> 'NO'))
      OR (column_name = 'created_at' AND (udt_name <> 'timestamptz' OR is_nullable <> 'NO' OR column_default NOT ILIKE '%now()%'))
      OR (column_name = 'updated_at' AND (udt_name <> 'timestamptz' OR is_nullable <> 'NO' OR column_default NOT ILIKE '%now()%'))
    );

  IF cardinality(invalid_columns) > 0 THEN
    RAISE EXCEPTION 'Invalid public.message_drafts column definitions: %', array_to_string(invalid_columns, ', ');
  END IF;

  SELECT regexp_replace(lower(pg_get_expr(defaults.adbin, defaults.adrelid)), '\s+|\(|\)', '', 'g')
  INTO content_default_expr
  FROM pg_attrdef defaults
  JOIN pg_attribute attributes
    ON attributes.attrelid = defaults.adrelid
   AND attributes.attnum = defaults.adnum
  WHERE defaults.adrelid = 'public.message_drafts'::regclass
    AND attributes.attname = 'content'
    AND NOT attributes.attisdropped;

  IF content_default_expr IS NULL
    OR content_default_expr IS DISTINCT FROM quote_literal(''::text) || '::text'
  THEN
    RAISE EXCEPTION 'public.message_drafts.content default must be exactly an empty string.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'message_drafts_pkey'
      AND conrelid = 'public.message_drafts'::regclass
      AND contype = 'p'
  ) THEN
    RAISE EXCEPTION 'Missing primary key constraint message_drafts_pkey.';
  END IF;

  SELECT pg_get_constraintdef(oid)
  INTO constraint_def
  FROM pg_constraint constraints
  WHERE constraints.conname = 'lectures_id_user_id_key'
    AND constraints.conrelid = 'public.lectures'::regclass
    AND constraints.contype = 'u';

  IF constraint_def IS NULL OR constraint_def NOT LIKE '%UNIQUE (id, user_id)%' THEN
    RAISE EXCEPTION 'Missing unique lecture owner constraint lectures_id_user_id_key.';
  END IF;

  SELECT pg_get_constraintdef(oid)
  INTO constraint_def
  FROM pg_constraint constraints
  WHERE constraints.conname = 'message_drafts_user_id_fkey'
    AND constraints.conrelid = 'public.message_drafts'::regclass
    AND constraints.contype = 'f'
    AND constraints.confrelid = 'auth.users'::regclass;

  IF constraint_def IS NULL OR constraint_def NOT LIKE '%FOREIGN KEY (user_id) REFERENCES auth.users(id)%' THEN
    RAISE EXCEPTION 'Missing auth.users foreign key message_drafts_user_id_fkey.';
  END IF;

  SELECT pg_get_constraintdef(oid)
  INTO constraint_def
  FROM pg_constraint constraints
  WHERE constraints.conname = 'message_drafts_lecture_owner_fkey'
    AND constraints.conrelid = 'public.message_drafts'::regclass
    AND constraints.contype = 'f'
    AND constraints.confrelid = 'public.lectures'::regclass
    AND constraints.confdeltype = 'c';

  IF constraint_def IS NULL
    OR constraint_def NOT LIKE '%FOREIGN KEY (lecture_id, user_id)%'
    OR constraint_def NOT LIKE '%REFERENCES lectures(id, user_id)%'
    OR constraint_def NOT LIKE '%ON DELETE CASCADE%'
  THEN
    RAISE EXCEPTION 'Missing cascading composite lecture foreign key message_drafts_lecture_owner_fkey.';
  END IF;

  SELECT pg_get_constraintdef(oid)
  INTO constraint_def
  FROM pg_constraint constraints
  WHERE constraints.conname = 'message_drafts_user_lecture_type_key'
    AND constraints.conrelid = 'public.message_drafts'::regclass
    AND constraints.contype = 'u';

  IF constraint_def IS NULL OR constraint_def NOT LIKE '%UNIQUE (user_id, lecture_id, message_type)%' THEN
    RAISE EXCEPTION 'Missing unique constraint message_drafts_user_lecture_type_key.';
  END IF;

  SELECT
    pg_get_constraintdef(constraints.oid),
    regexp_replace(
      lower(pg_get_expr(constraints.conbin, constraints.conrelid)),
      '\s+|::text|\(|\)',
      '',
      'g'
    )
  INTO constraint_def, constraint_expr
  FROM pg_constraint constraints
  JOIN pg_attribute attributes
    ON attributes.attrelid = constraints.conrelid
   AND attributes.attname = 'message_type'
   AND NOT attributes.attisdropped
  WHERE constraints.conname = 'message_drafts_message_type_check'
    AND constraints.conrelid = 'public.message_drafts'::regclass
    AND constraints.contype = 'c'
    AND constraints.conkey = ARRAY[attributes.attnum]::smallint[];

  IF constraint_def IS NULL THEN
    RAISE EXCEPTION 'Missing check constraint message_drafts_message_type_check.';
  END IF;

  IF constraint_expr IS DISTINCT FROM
    'message_type=anyarray[''reminder'',''confirm'',''thankyou'',''custom'']'
  THEN
    RAISE EXCEPTION
      'message_drafts_message_type_check must allow exactly reminder, confirm, thankyou, custom.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger trigger
    JOIN pg_class target_class ON target_class.oid = trigger.tgrelid
    JOIN pg_namespace target_namespace ON target_namespace.oid = target_class.relnamespace
    JOIN pg_proc proc ON proc.oid = trigger.tgfoid
    JOIN pg_namespace proc_namespace ON proc_namespace.oid = proc.pronamespace
    WHERE target_namespace.nspname = 'public'
      AND target_class.relname = 'message_drafts'
      AND trigger.tgname = 'message_drafts_set_updated_at'
      AND NOT trigger.tgisinternal
      AND trigger.tgenabled <> 'D'
      AND trigger.tgtype = 19
      AND trigger.tgnargs = 0
      AND proc_namespace.nspname = 'public'
      AND proc.proname = 'set_message_drafts_updated_at'
      AND proc.pronargs = 0
      AND proc.prorettype = 'trigger'::regtype
  ) THEN
    RAISE EXCEPTION
      'message_drafts_set_updated_at must be an enabled BEFORE UPDATE FOR EACH ROW trigger using public.set_message_drafts_updated_at().';
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
  IF NOT has_table_privilege('authenticated', 'public.message_drafts', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated does not have SELECT privilege on public.message_drafts.';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.message_drafts', 'INSERT') THEN
    RAISE EXCEPTION 'authenticated does not have INSERT privilege on public.message_drafts.';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.message_drafts', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated does not have UPDATE privilege on public.message_drafts.';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.message_drafts', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated does not have DELETE privilege on public.message_drafts.';
  END IF;

  IF has_table_privilege('anon', 'public.message_drafts', 'SELECT') THEN
    RAISE EXCEPTION 'anon unexpectedly has SELECT privilege on public.message_drafts.';
  END IF;

  IF has_table_privilege('anon', 'public.message_drafts', 'INSERT') THEN
    RAISE EXCEPTION 'anon unexpectedly has INSERT privilege on public.message_drafts.';
  END IF;

  IF has_table_privilege('anon', 'public.message_drafts', 'UPDATE') THEN
    RAISE EXCEPTION 'anon unexpectedly has UPDATE privilege on public.message_drafts.';
  END IF;

  IF has_table_privilege('anon', 'public.message_drafts', 'DELETE') THEN
    RAISE EXCEPTION 'anon unexpectedly has DELETE privilege on public.message_drafts.';
  END IF;

  SELECT count(*)
  INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'message_drafts';

  IF policy_count <> 4 THEN
    RAISE EXCEPTION 'public.message_drafts must have exactly four RLS policies.';
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
