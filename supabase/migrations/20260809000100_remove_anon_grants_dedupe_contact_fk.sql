-- Remove anonymous CRUD grants and normalize the cascading lecture contact-log FK.

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
  missing_tables text[];
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
END $$;
DO $$
DECLARE
  validation_phase constant text := 'Protected-state precondition';
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
  auth_users_oid oid := to_regclass('auth.users');
  auth_users_id_attnum smallint;
  target_table text;
  target_command text;
  target_table_oid oid;
  user_id_attnum smallint;
  overall_policy_count integer;
  table_policy_count integer;
  permissive_policy_count integer;
  restrictive_policy_count integer;
  command_policy_count integer;
  policy_names text[];
  actual_policy_name name;
  policy_qual text;
  policy_with_check text;
  qual_is_owner_expression boolean;
  with_check_is_owner_expression boolean;
  user_fk_count integer;
  user_fk record;
BEGIN
  IF auth_users_oid IS NULL THEN
    RAISE EXCEPTION '% failed: missing required table auth.users.', validation_phase;
  END IF;

  SELECT attribute.attnum
  INTO auth_users_id_attnum
  FROM pg_attribute attribute
  WHERE attribute.attrelid = auth_users_oid
    AND attribute.attname = 'id'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  IF auth_users_id_attnum IS NULL THEN
    RAISE EXCEPTION '% failed: missing required column auth.users.id.', validation_phase;
  END IF;

  SELECT count(*)
  INTO overall_policy_count
  FROM pg_policies policy_row
  WHERE policy_row.schemaname = 'public'
    AND policy_row.tablename = ANY(required_tables);

  IF overall_policy_count <> 24 THEN
    RAISE EXCEPTION
      '% failed: expected exactly 24 policies across protected public tables; found %.',
      validation_phase,
      overall_policy_count;
  END IF;

  FOREACH target_table IN ARRAY required_tables LOOP
    target_table_oid := to_regclass(format('public.%I', target_table));

    IF target_table_oid IS NULL THEN
      RAISE EXCEPTION '% failed: missing public.%', validation_phase, target_table;
    END IF;

    FOREACH target_command IN ARRAY required_commands LOOP
      IF NOT has_table_privilege(
        'authenticated',
        target_table_oid,
        target_command
      ) THEN
        RAISE EXCEPTION
          '% failed: authenticated is missing % on public.%.',
          validation_phase,
          target_command,
          target_table;
      END IF;
    END LOOP;

    IF NOT (
      SELECT relation.relrowsecurity
      FROM pg_class relation
      WHERE relation.oid = target_table_oid
    ) THEN
      RAISE EXCEPTION '% failed: RLS is disabled on public.%.', validation_phase, target_table;
    END IF;

    SELECT
      count(*),
      count(*) FILTER (WHERE policy_row.permissive = 'PERMISSIVE'),
      count(*) FILTER (WHERE policy_row.permissive = 'RESTRICTIVE'),
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
    INTO
      table_policy_count,
      permissive_policy_count,
      restrictive_policy_count,
      policy_names
    FROM pg_policies policy_row
    WHERE policy_row.schemaname = 'public'
      AND policy_row.tablename = target_table;

    IF table_policy_count <> 4
      OR permissive_policy_count <> 4
      OR restrictive_policy_count <> 0 THEN
      RAISE EXCEPTION
        '% failed: public.% must have exactly four permissive policies and no restrictive policies; total=%, permissive=%, restrictive=%, policies=%.',
        validation_phase,
        target_table,
        table_policy_count,
        permissive_policy_count,
        restrictive_policy_count,
        array_to_string(policy_names, '; ');
    END IF;

    FOREACH target_command IN ARRAY required_commands LOOP
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
          '% failed: expected one permissive authenticated % owner policy on public.%; found %: %.',
          validation_phase,
          target_command,
          target_table,
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
        IF NOT qual_is_owner_expression OR policy_with_check IS NOT NULL THEN
          RAISE EXCEPTION
            '% failed: invalid % owner policy % on public.%. USING=%, WITH CHECK=%.',
            validation_phase,
            target_command,
            actual_policy_name,
            target_table,
            policy_qual,
            policy_with_check;
        END IF;
      ELSIF target_command = 'INSERT' THEN
        IF policy_qual IS NOT NULL OR NOT with_check_is_owner_expression THEN
          RAISE EXCEPTION
            '% failed: invalid INSERT owner policy % on public.%. USING=%, WITH CHECK=%.',
            validation_phase,
            actual_policy_name,
            target_table,
            policy_qual,
            policy_with_check;
        END IF;
      ELSIF target_command = 'UPDATE' THEN
        IF NOT qual_is_owner_expression OR NOT with_check_is_owner_expression THEN
          RAISE EXCEPTION
            '% failed: invalid UPDATE owner policy % on public.%. USING=%, WITH CHECK=%.',
            validation_phase,
            actual_policy_name,
            target_table,
            policy_qual,
            policy_with_check;
        END IF;
      END IF;
    END LOOP;

    SELECT attribute.attnum
    INTO user_id_attnum
    FROM pg_attribute attribute
    WHERE attribute.attrelid = target_table_oid
      AND attribute.attname = 'user_id'
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped;

    IF user_id_attnum IS NULL THEN
      RAISE EXCEPTION '% failed: missing public.%.user_id.', validation_phase, target_table;
    END IF;

    SELECT count(*)
    INTO user_fk_count
    FROM pg_constraint constraint_row
    WHERE constraint_row.contype = 'f'
      AND constraint_row.conrelid = target_table_oid
      AND constraint_row.confrelid = auth_users_oid
      AND constraint_row.conkey = ARRAY[user_id_attnum]::smallint[]
      AND constraint_row.confkey = ARRAY[auth_users_id_attnum]::smallint[];

    IF user_fk_count <> 1 THEN
      RAISE EXCEPTION
        '% failed: expected exactly one user_id FK from public.% to auth.users(id); found %.',
        validation_phase,
        target_table,
        user_fk_count;
    END IF;

    SELECT constraint_row.*
    INTO user_fk
    FROM pg_constraint constraint_row
    WHERE constraint_row.contype = 'f'
      AND constraint_row.conrelid = target_table_oid
      AND constraint_row.confrelid = auth_users_oid
      AND constraint_row.conkey = ARRAY[user_id_attnum]::smallint[]
      AND constraint_row.confkey = ARRAY[auth_users_id_attnum]::smallint[];

    IF user_fk.confdeltype <> 'a'
      OR user_fk.confupdtype <> 'a'
      OR user_fk.confmatchtype <> 's'
      OR user_fk.condeferrable
      OR user_fk.condeferred
      OR user_fk.conparentid <> 0
      OR NOT user_fk.conislocal
      OR user_fk.coninhcount <> 0
      OR NOT user_fk.connoinherit
      OR NOT user_fk.convalidated THEN
      RAISE EXCEPTION
        '% failed: public.%.user_id FK has unexpected semantics or is not validated: %.',
        validation_phase,
        target_table,
        pg_get_constraintdef(user_fk.oid, true);
    END IF;
  END LOOP;
END $$;

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
  target_table text;
  target_columns text;
BEGIN
  FOREACH target_table IN ARRAY required_tables LOOP
    SELECT string_agg(format('%I', attribute.attname), ', ' ORDER BY attribute.attnum)
    INTO target_columns
    FROM pg_attribute attribute
    WHERE attribute.attrelid = format('%I.%I', 'public', target_table)::regclass
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped;

    IF target_columns IS NULL THEN
      RAISE EXCEPTION 'No user columns found on public.%', target_table;
    END IF;

    EXECUTE format(
      'REVOKE SELECT (%s), INSERT (%s), UPDATE (%s) ON TABLE public.%I FROM anon',
      target_columns,
      target_columns,
      target_columns,
      target_table
    );

    EXECUTE format(
      'REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I FROM anon',
      target_table
    );
  END LOOP;
END $$;

DO $$
DECLARE
  contact_logs_oid oid := to_regclass('public.lecture_contact_logs');
  lectures_oid oid := to_regclass('public.lectures');
  lecture_id_attnum smallint;
  lectures_id_attnum smallint;
  pair_fk_count integer;
  retained_constraint_oid oid;
  retained_constraint_name name;
  retained_constraint_validated boolean;
  retained_constraint_index_oid oid;
  retained_pfeqop oid[];
  retained_ppeqop oid[];
  retained_ffeqop oid[];
  retained_noinherit boolean;
  unexpected_constraints text[];
  duplicate_constraint record;
  final_constraint record;
BEGIN
  LOCK TABLE public.lecture_contact_logs IN ACCESS EXCLUSIVE MODE;

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
  INTO pair_fk_count
  FROM pg_constraint constraint_row
  WHERE constraint_row.contype = 'f'
    AND constraint_row.conrelid = contact_logs_oid
    AND constraint_row.confrelid = lectures_oid
    AND constraint_row.conkey = ARRAY[lecture_id_attnum]::smallint[]
    AND constraint_row.confkey = ARRAY[lectures_id_attnum]::smallint[];

  IF pair_fk_count = 0 THEN
    RAISE EXCEPTION
      'Missing required FK from lecture_contact_logs."lectureId" to lectures.id.';
  ELSIF pair_fk_count > 2 THEN
    RAISE EXCEPTION
      'Expected one or two FKs from lecture_contact_logs."lectureId" to lectures.id; found %.',
      pair_fk_count;
  END IF;

  IF pair_fk_count > 0 THEN
    SELECT coalesce(
      array_agg(
        format('%I: %s', constraint_row.conname, pg_get_constraintdef(constraint_row.oid, true))
        ORDER BY constraint_row.conname
      ),
      ARRAY[]::text[]
    )
    INTO unexpected_constraints
    FROM pg_constraint constraint_row
    WHERE constraint_row.contype = 'f'
      AND constraint_row.conrelid = contact_logs_oid
      AND constraint_row.confrelid = lectures_oid
      AND constraint_row.conkey = ARRAY[lecture_id_attnum]::smallint[]
      AND constraint_row.confkey = ARRAY[lectures_id_attnum]::smallint[]
      AND (
        constraint_row.confdeltype <> 'c'
        OR constraint_row.confupdtype <> 'a'
        OR constraint_row.confmatchtype <> 's'
        OR constraint_row.condeferrable
        OR constraint_row.condeferred
        OR constraint_row.conparentid <> 0
        OR NOT constraint_row.conislocal
        OR constraint_row.coninhcount <> 0
        OR NOT constraint_row.convalidated
      );

    IF cardinality(unexpected_constraints) > 0 THEN
      RAISE EXCEPTION
        'Unexpected FK semantics on lecture_contact_logs."lectureId" -> lectures.id: %',
        array_to_string(unexpected_constraints, '; ');
    END IF;
  END IF;

  SELECT
    constraint_row.oid,
    constraint_row.conname,
    constraint_row.convalidated,
    constraint_row.conindid,
    constraint_row.conpfeqop,
    constraint_row.conppeqop,
    constraint_row.conffeqop,
    constraint_row.connoinherit
  INTO
    retained_constraint_oid,
    retained_constraint_name,
    retained_constraint_validated,
    retained_constraint_index_oid,
    retained_pfeqop,
    retained_ppeqop,
    retained_ffeqop,
    retained_noinherit
  FROM pg_constraint constraint_row
  WHERE constraint_row.contype = 'f'
    AND constraint_row.conrelid = contact_logs_oid
    AND constraint_row.confrelid = lectures_oid
    AND constraint_row.conkey = ARRAY[lecture_id_attnum]::smallint[]
    AND constraint_row.confkey = ARRAY[lectures_id_attnum]::smallint[]
    AND constraint_row.confdeltype = 'c'
    AND constraint_row.confupdtype = 'a'
    AND constraint_row.confmatchtype = 's'
    AND NOT constraint_row.condeferrable
    AND NOT constraint_row.condeferred
    AND constraint_row.conparentid = 0
    AND constraint_row.conislocal
    AND constraint_row.coninhcount = 0
  ORDER BY
    constraint_row.convalidated DESC,
    (constraint_row.conname = 'lecture_contact_logs_lecture_id_fkey') DESC,
    constraint_row.oid
  LIMIT 1;

  IF retained_constraint_oid IS NULL THEN
    RAISE EXCEPTION 'No acceptable FK found for lecture_contact_logs."lectureId" -> lectures.id.';
  END IF;

  SELECT coalesce(
    array_agg(
      format('%I: %s', constraint_row.conname, pg_get_constraintdef(constraint_row.oid, true))
      ORDER BY constraint_row.conname
    ),
    ARRAY[]::text[]
  )
  INTO unexpected_constraints
  FROM pg_constraint constraint_row
  WHERE constraint_row.contype = 'f'
    AND constraint_row.conrelid = contact_logs_oid
    AND constraint_row.confrelid = lectures_oid
    AND constraint_row.conkey = ARRAY[lecture_id_attnum]::smallint[]
    AND constraint_row.confkey = ARRAY[lectures_id_attnum]::smallint[]
    AND constraint_row.oid <> retained_constraint_oid
    AND (
      constraint_row.conindid IS DISTINCT FROM retained_constraint_index_oid
      OR constraint_row.conpfeqop IS DISTINCT FROM retained_pfeqop
      OR constraint_row.conppeqop IS DISTINCT FROM retained_ppeqop
      OR constraint_row.conffeqop IS DISTINCT FROM retained_ffeqop
      OR constraint_row.convalidated IS DISTINCT FROM retained_constraint_validated
      OR constraint_row.connoinherit IS DISTINCT FROM retained_noinherit
    );

  IF cardinality(unexpected_constraints) > 0 THEN
    RAISE EXCEPTION
      'Non-duplicate FK semantics found on lecture_contact_logs."lectureId" -> lectures.id: %',
      array_to_string(unexpected_constraints, '; ');
  END IF;
  IF pair_fk_count = 2 THEN

  FOR duplicate_constraint IN
    SELECT constraint_row.conname
    FROM pg_constraint constraint_row
    WHERE constraint_row.contype = 'f'
      AND constraint_row.conrelid = contact_logs_oid
      AND constraint_row.confrelid = lectures_oid
      AND constraint_row.conkey = ARRAY[lecture_id_attnum]::smallint[]
      AND constraint_row.confkey = ARRAY[lectures_id_attnum]::smallint[]
      AND constraint_row.oid <> retained_constraint_oid
    ORDER BY constraint_row.oid
  LOOP
    EXECUTE format(
      'ALTER TABLE public.lecture_contact_logs DROP CONSTRAINT %I',
      duplicate_constraint.conname
    );
  END LOOP;
  END IF;


  SELECT count(*)
  INTO pair_fk_count
  FROM pg_constraint constraint_row
  WHERE constraint_row.contype = 'f'
    AND constraint_row.conrelid = contact_logs_oid
    AND constraint_row.confrelid = lectures_oid
    AND constraint_row.conkey = ARRAY[lecture_id_attnum]::smallint[]
    AND constraint_row.confkey = ARRAY[lectures_id_attnum]::smallint[];

  IF pair_fk_count <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly one FK from lecture_contact_logs."lectureId" to lectures.id before commit; found %.',
      pair_fk_count;
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
    OR final_constraint.coninhcount <> 0
    OR NOT final_constraint.convalidated THEN
    RAISE EXCEPTION
      'Final lecture_contact_logs."lectureId" FK has unexpected semantics or is not validated: %',
      pg_get_constraintdef(final_constraint.oid, true);
  END IF;
END $$;

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
  target_table text;
  target_command text;
BEGIN
  FOREACH target_table IN ARRAY required_tables LOOP
    FOREACH target_command IN ARRAY required_commands LOOP
      IF has_table_privilege(
        'anon',
        format('%I.%I', 'public', target_table),
        target_command
      ) THEN
        RAISE EXCEPTION 'anon still has % on public.% before commit.', target_command, target_table;
      END IF;
    END LOOP;

    FOREACH target_command IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE'] LOOP
      IF has_any_column_privilege(
        'anon',
        format('%I.%I', 'public', target_table),
        target_command
      ) THEN
        RAISE EXCEPTION
          'anon still has column-level % on public.% before commit.',
          target_command,
          target_table;
      END IF;
    END LOOP;
  END LOOP;
END $$;

DO $$
DECLARE
  validation_phase constant text := 'Protected-state postcondition';
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
  auth_users_oid oid := to_regclass('auth.users');
  auth_users_id_attnum smallint;
  target_table text;
  target_command text;
  target_table_oid oid;
  user_id_attnum smallint;
  overall_policy_count integer;
  table_policy_count integer;
  permissive_policy_count integer;
  restrictive_policy_count integer;
  command_policy_count integer;
  policy_names text[];
  actual_policy_name name;
  policy_qual text;
  policy_with_check text;
  qual_is_owner_expression boolean;
  with_check_is_owner_expression boolean;
  user_fk_count integer;
  user_fk record;
BEGIN
  IF auth_users_oid IS NULL THEN
    RAISE EXCEPTION '% failed: missing required table auth.users.', validation_phase;
  END IF;

  SELECT attribute.attnum
  INTO auth_users_id_attnum
  FROM pg_attribute attribute
  WHERE attribute.attrelid = auth_users_oid
    AND attribute.attname = 'id'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  IF auth_users_id_attnum IS NULL THEN
    RAISE EXCEPTION '% failed: missing required column auth.users.id.', validation_phase;
  END IF;

  SELECT count(*)
  INTO overall_policy_count
  FROM pg_policies policy_row
  WHERE policy_row.schemaname = 'public'
    AND policy_row.tablename = ANY(required_tables);

  IF overall_policy_count <> 24 THEN
    RAISE EXCEPTION
      '% failed: expected exactly 24 policies across protected public tables; found %.',
      validation_phase,
      overall_policy_count;
  END IF;

  FOREACH target_table IN ARRAY required_tables LOOP
    target_table_oid := to_regclass(format('public.%I', target_table));

    IF target_table_oid IS NULL THEN
      RAISE EXCEPTION '% failed: missing public.%', validation_phase, target_table;
    END IF;

    FOREACH target_command IN ARRAY required_commands LOOP
      IF NOT has_table_privilege(
        'authenticated',
        target_table_oid,
        target_command
      ) THEN
        RAISE EXCEPTION
          '% failed: authenticated is missing % on public.%.',
          validation_phase,
          target_command,
          target_table;
      END IF;
    END LOOP;

    IF NOT (
      SELECT relation.relrowsecurity
      FROM pg_class relation
      WHERE relation.oid = target_table_oid
    ) THEN
      RAISE EXCEPTION '% failed: RLS is disabled on public.%.', validation_phase, target_table;
    END IF;

    SELECT
      count(*),
      count(*) FILTER (WHERE policy_row.permissive = 'PERMISSIVE'),
      count(*) FILTER (WHERE policy_row.permissive = 'RESTRICTIVE'),
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
    INTO
      table_policy_count,
      permissive_policy_count,
      restrictive_policy_count,
      policy_names
    FROM pg_policies policy_row
    WHERE policy_row.schemaname = 'public'
      AND policy_row.tablename = target_table;

    IF table_policy_count <> 4
      OR permissive_policy_count <> 4
      OR restrictive_policy_count <> 0 THEN
      RAISE EXCEPTION
        '% failed: public.% must have exactly four permissive policies and no restrictive policies; total=%, permissive=%, restrictive=%, policies=%.',
        validation_phase,
        target_table,
        table_policy_count,
        permissive_policy_count,
        restrictive_policy_count,
        array_to_string(policy_names, '; ');
    END IF;

    FOREACH target_command IN ARRAY required_commands LOOP
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
          '% failed: expected one permissive authenticated % owner policy on public.%; found %: %.',
          validation_phase,
          target_command,
          target_table,
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
        IF NOT qual_is_owner_expression OR policy_with_check IS NOT NULL THEN
          RAISE EXCEPTION
            '% failed: invalid % owner policy % on public.%. USING=%, WITH CHECK=%.',
            validation_phase,
            target_command,
            actual_policy_name,
            target_table,
            policy_qual,
            policy_with_check;
        END IF;
      ELSIF target_command = 'INSERT' THEN
        IF policy_qual IS NOT NULL OR NOT with_check_is_owner_expression THEN
          RAISE EXCEPTION
            '% failed: invalid INSERT owner policy % on public.%. USING=%, WITH CHECK=%.',
            validation_phase,
            actual_policy_name,
            target_table,
            policy_qual,
            policy_with_check;
        END IF;
      ELSIF target_command = 'UPDATE' THEN
        IF NOT qual_is_owner_expression OR NOT with_check_is_owner_expression THEN
          RAISE EXCEPTION
            '% failed: invalid UPDATE owner policy % on public.%. USING=%, WITH CHECK=%.',
            validation_phase,
            actual_policy_name,
            target_table,
            policy_qual,
            policy_with_check;
        END IF;
      END IF;
    END LOOP;

    SELECT attribute.attnum
    INTO user_id_attnum
    FROM pg_attribute attribute
    WHERE attribute.attrelid = target_table_oid
      AND attribute.attname = 'user_id'
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped;

    IF user_id_attnum IS NULL THEN
      RAISE EXCEPTION '% failed: missing public.%.user_id.', validation_phase, target_table;
    END IF;

    SELECT count(*)
    INTO user_fk_count
    FROM pg_constraint constraint_row
    WHERE constraint_row.contype = 'f'
      AND constraint_row.conrelid = target_table_oid
      AND constraint_row.confrelid = auth_users_oid
      AND constraint_row.conkey = ARRAY[user_id_attnum]::smallint[]
      AND constraint_row.confkey = ARRAY[auth_users_id_attnum]::smallint[];

    IF user_fk_count <> 1 THEN
      RAISE EXCEPTION
        '% failed: expected exactly one user_id FK from public.% to auth.users(id); found %.',
        validation_phase,
        target_table,
        user_fk_count;
    END IF;

    SELECT constraint_row.*
    INTO user_fk
    FROM pg_constraint constraint_row
    WHERE constraint_row.contype = 'f'
      AND constraint_row.conrelid = target_table_oid
      AND constraint_row.confrelid = auth_users_oid
      AND constraint_row.conkey = ARRAY[user_id_attnum]::smallint[]
      AND constraint_row.confkey = ARRAY[auth_users_id_attnum]::smallint[];

    IF user_fk.confdeltype <> 'a'
      OR user_fk.confupdtype <> 'a'
      OR user_fk.confmatchtype <> 's'
      OR user_fk.condeferrable
      OR user_fk.condeferred
      OR user_fk.conparentid <> 0
      OR NOT user_fk.conislocal
      OR user_fk.coninhcount <> 0
      OR NOT user_fk.connoinherit
      OR NOT user_fk.convalidated THEN
      RAISE EXCEPTION
        '% failed: public.%.user_id FK has unexpected semantics or is not validated: %.',
        validation_phase,
        target_table,
        pg_get_constraintdef(user_fk.oid, true);
    END IF;
  END LOOP;
END $$;
COMMIT;
