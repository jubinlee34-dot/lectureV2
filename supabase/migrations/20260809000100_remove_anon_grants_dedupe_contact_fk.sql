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
  new_constraint_name text := 'lecture_contact_logs_lecture_id_fkey';
  name_suffix integer := 1;
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
      );

    IF cardinality(unexpected_constraints) > 0 THEN
      RAISE EXCEPTION
        'Unexpected FK semantics on lecture_contact_logs."lectureId" -> lectures.id: %',
        array_to_string(unexpected_constraints, '; ');
    END IF;
  ELSE
    WHILE EXISTS (
      SELECT 1
      FROM pg_constraint existing_constraint
      WHERE existing_constraint.conrelid = contact_logs_oid
        AND existing_constraint.conname = new_constraint_name
    ) LOOP
      new_constraint_name := format(
        'lecture_contact_logs_lecture_id_cascade_fkey_%s',
        name_suffix
      );
      name_suffix := name_suffix + 1;
    END LOOP;

    EXECUTE format(
      'ALTER TABLE public.lecture_contact_logs
         ADD CONSTRAINT %I
         FOREIGN KEY ("lectureId")
         REFERENCES public.lectures(id)
         MATCH SIMPLE
         ON UPDATE NO ACTION
         ON DELETE CASCADE
         NOT DEFERRABLE',
      new_constraint_name
    );
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
      OR constraint_row.connoinherit IS DISTINCT FROM retained_noinherit
    );

  IF cardinality(unexpected_constraints) > 0 THEN
    RAISE EXCEPTION
      'Non-duplicate FK semantics found on lecture_contact_logs."lectureId" -> lectures.id: %',
      array_to_string(unexpected_constraints, '; ');
  END IF;

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

  IF NOT retained_constraint_validated THEN
    EXECUTE format(
      'ALTER TABLE public.lecture_contact_logs VALIDATE CONSTRAINT %I',
      retained_constraint_name
    );
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

COMMIT;
