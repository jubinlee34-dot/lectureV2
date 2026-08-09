-- Read-only verification for anonymous grants, authenticated access, RLS, and
-- the lecture contact-log foreign key.

BEGIN;

DO $$
DECLARE
  required_tables text[] := ARRAY[
    'lectures',
    'todos',
    'work_tasks',
    'sms_history',
    'lecture_contact_logs',
    'instructor_profile'
  ];
  required_commands text[] := ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
  owner_expression_uid_left_regex text := '^[[:space:]]*[(]*[[:space:]]*(select[[:space:]]+)?auth[.]uid[(][)]([[:space:]]+as[[:space:]]+uid)?[[:space:]]*[)]*[[:space:]]*=[[:space:]]*user_id[[:space:]]*[)]*[[:space:]]*$';
  owner_expression_uid_right_regex text := '^[[:space:]]*[(]*[[:space:]]*user_id[[:space:]]*=[[:space:]]*[(]*[[:space:]]*(select[[:space:]]+)?auth[.]uid[(][)]([[:space:]]+as[[:space:]]+uid)?[[:space:]]*[)]*[[:space:]]*$';
  target_table text;
  target_command text;
  missing_tables text[];
  rls_disabled_tables text[];
  total_policy_count integer;
  command_policy_count integer;
  policy_names text[];
  expected_policy_name text;
  actual_policy_name name;
  policy_qual text;
  policy_with_check text;
  qual_is_owner_expression boolean;
  with_check_is_owner_expression boolean;
  contact_logs_oid oid;
  lectures_oid oid;
  lecture_id_attnum smallint;
  lectures_id_attnum smallint;
  matching_fk_count integer;
  final_constraint record;
BEGIN
  SELECT coalesce(array_agg(required.table_name ORDER BY required.table_name), ARRAY[]::text[])
  INTO missing_tables
  FROM unnest(required_tables) AS required(table_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_class target
    JOIN pg_namespace target_namespace
      ON target_namespace.oid = target.relnamespace
    WHERE target_namespace.nspname = 'public'
      AND target.relname = required.table_name
      AND target.relkind IN ('r', 'p')
  );

  IF cardinality(missing_tables) > 0 THEN
    RAISE EXCEPTION 'Missing required public tables: %', array_to_string(missing_tables, ', ');
  END IF;

  FOREACH target_table IN ARRAY required_tables LOOP
    FOREACH target_command IN ARRAY required_commands LOOP
      IF has_table_privilege(
        'anon',
        format('%I.%I', 'public', target_table),
        target_command
      ) THEN
        RAISE EXCEPTION 'anon still has % on public.%', target_command, target_table;
      END IF;

      IF NOT has_table_privilege(
        'authenticated',
        format('%I.%I', 'public', target_table),
        target_command
      ) THEN
        RAISE EXCEPTION 'authenticated is missing % on public.%', target_command, target_table;
      END IF;
    END LOOP;

    FOREACH target_command IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE'] LOOP
      IF has_any_column_privilege(
        'anon',
        format('%I.%I', 'public', target_table),
        target_command
      ) THEN
        RAISE EXCEPTION
          'anon still has column-level % on public.%',
          target_command,
          target_table;
      END IF;
    END LOOP;
  END LOOP;

  SELECT coalesce(array_agg(target.relname ORDER BY target.relname), ARRAY[]::text[])
  INTO rls_disabled_tables
  FROM pg_class target
  JOIN pg_namespace target_namespace
    ON target_namespace.oid = target.relnamespace
  WHERE target_namespace.nspname = 'public'
    AND target.relname = ANY(required_tables)
    AND target.relkind IN ('r', 'p')
    AND NOT target.relrowsecurity;

  IF cardinality(rls_disabled_tables) > 0 THEN
    RAISE EXCEPTION 'RLS is disabled on public tables: %', array_to_string(rls_disabled_tables, ', ');
  END IF;

  FOREACH target_table IN ARRAY required_tables LOOP
    SELECT
      count(*),
      coalesce(
        array_agg(
          format(
            '%I [%s, %s, roles=%s]',
            policy_row.policyname,
            policy_row.cmd,
            policy_row.permissive,
            array_to_string(policy_row.roles, ',')
          )
          ORDER BY policy_row.policyname
        ),
        ARRAY[]::text[]
      )
    INTO total_policy_count, policy_names
    FROM pg_policies policy_row
    WHERE policy_row.schemaname = 'public'
      AND policy_row.tablename = target_table
      AND policy_row.permissive = 'PERMISSIVE';

    IF total_policy_count <> 4 THEN
      RAISE EXCEPTION
        'public.% must have exactly four owner policies; found %: %',
        target_table,
        total_policy_count,
        array_to_string(policy_names, '; ');
    END IF;

    FOREACH target_command IN ARRAY required_commands LOOP
      expected_policy_name := format(
        'Users can %s own %s',
        lower(target_command),
        target_table
      );

      SELECT
        count(*),
        coalesce(array_agg(policy_row.policyname::text ORDER BY policy_row.policyname), ARRAY[]::text[])
      INTO command_policy_count, policy_names
      FROM pg_policies policy_row
      WHERE policy_row.schemaname = 'public'
        AND policy_row.tablename = target_table
        AND policy_row.cmd = target_command
        AND policy_row.permissive = 'PERMISSIVE'
        AND policy_row.roles = ARRAY['authenticated']::name[];

      IF command_policy_count <> 1 THEN
        RAISE EXCEPTION
          'Expected one permissive authenticated % owner policy on public.% (diagnostic expected name: %); found %: %',
          target_command,
          target_table,
          expected_policy_name,
          command_policy_count,
          array_to_string(policy_names, ', ');
      END IF;

      SELECT
        policy_row.policyname,
        policy_row.qual,
        policy_row.with_check
      INTO
        actual_policy_name,
        policy_qual,
        policy_with_check
      FROM pg_policies policy_row
      WHERE policy_row.schemaname = 'public'
        AND policy_row.tablename = target_table
        AND policy_row.cmd = target_command
        AND policy_row.permissive = 'PERMISSIVE'
        AND policy_row.roles = ARRAY['authenticated']::name[];

      qual_is_owner_expression := coalesce(
        policy_qual ~* owner_expression_uid_left_regex
          OR policy_qual ~* owner_expression_uid_right_regex,
        false
      );
      with_check_is_owner_expression := coalesce(
        policy_with_check ~* owner_expression_uid_left_regex
          OR policy_with_check ~* owner_expression_uid_right_regex,
        false
      );

      IF target_command IN ('SELECT', 'DELETE') THEN
        IF NOT qual_is_owner_expression
          OR policy_with_check IS NOT NULL THEN
          RAISE EXCEPTION
            'Invalid % owner policy % on public.% (diagnostic expected name: %). USING=%, WITH CHECK=%',
            target_command,
            actual_policy_name,
            target_table,
            expected_policy_name,
            policy_qual,
            policy_with_check;
        END IF;
      ELSIF target_command = 'INSERT' THEN
        IF policy_qual IS NOT NULL
          OR NOT with_check_is_owner_expression THEN
          RAISE EXCEPTION
            'Invalid INSERT owner policy % on public.% (diagnostic expected name: %). USING=%, WITH CHECK=%',
            actual_policy_name,
            target_table,
            expected_policy_name,
            policy_qual,
            policy_with_check;
        END IF;
      ELSIF target_command = 'UPDATE' THEN
        IF NOT qual_is_owner_expression
          OR NOT with_check_is_owner_expression THEN
          RAISE EXCEPTION
            'Invalid UPDATE owner policy % on public.% (diagnostic expected name: %). USING=%, WITH CHECK=%',
            actual_policy_name,
            target_table,
            expected_policy_name,
            policy_qual,
            policy_with_check;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  LOCK TABLE public.lectures, public.lecture_contact_logs IN ACCESS SHARE MODE;

  contact_logs_oid := to_regclass('public.lecture_contact_logs');
  lectures_oid := to_regclass('public.lectures');

  SELECT attribute.attnum
  INTO lecture_id_attnum
  FROM pg_attribute attribute
  WHERE attribute.attrelid = contact_logs_oid
    AND attribute.attname = 'lectureId'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  IF lecture_id_attnum IS NULL THEN
    RAISE EXCEPTION 'Missing required column public.lecture_contact_logs."lectureId".';
  END IF;

  SELECT attribute.attnum
  INTO lectures_id_attnum
  FROM pg_attribute attribute
  WHERE attribute.attrelid = lectures_oid
    AND attribute.attname = 'id'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  IF lectures_id_attnum IS NULL THEN
    RAISE EXCEPTION 'Missing required column public.lectures.id.';
  END IF;

  SELECT count(*)
  INTO matching_fk_count
  FROM pg_constraint constraint_row
  WHERE constraint_row.contype = 'f'
    AND constraint_row.conrelid = contact_logs_oid
    AND constraint_row.confrelid = lectures_oid
    AND constraint_row.conkey = ARRAY[lecture_id_attnum]::smallint[]
    AND constraint_row.confkey = ARRAY[lectures_id_attnum]::smallint[];

  IF matching_fk_count <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly one FK from lecture_contact_logs."lectureId" to lectures.id; found %.',
      matching_fk_count;
  END IF;

  SELECT constraint_row.*
  INTO final_constraint
  FROM pg_constraint constraint_row
  WHERE constraint_row.contype = 'f'
    AND constraint_row.conrelid = contact_logs_oid
    AND constraint_row.confrelid = lectures_oid
    AND constraint_row.conkey = ARRAY[lecture_id_attnum]::smallint[]
    AND constraint_row.confkey = ARRAY[lectures_id_attnum]::smallint[];

  IF final_constraint.confdeltype <> 'c'
    OR final_constraint.confupdtype <> 'a'
    OR final_constraint.confmatchtype <> 's'
    OR final_constraint.condeferrable
    OR final_constraint.condeferred
    OR final_constraint.conparentid <> 0
    OR NOT final_constraint.conislocal
    OR final_constraint.coninhcount <> 0 THEN
    RAISE EXCEPTION
      'The lecture_contact_logs."lectureId" FK has unexpected semantics: %',
      pg_get_constraintdef(final_constraint.oid, true);
  END IF;

  IF NOT final_constraint.convalidated THEN
    RAISE EXCEPTION 'The lecture_contact_logs."lectureId" FK must be validated.';
  END IF;
END $$;

COMMIT;
