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
  target_table text;
  missing_tables text[];
  missing_user_id_tables text[];
  invalid_user_id_type_tables text[];
  rls_disabled_tables text[];
  null_owner_count bigint;
  orphan_owner_count bigint;
BEGIN
  SELECT coalesce(array_agg(table_name ORDER BY table_name), ARRAY[]::text[])
  INTO missing_tables
  FROM unnest(required_tables) AS required(table_name)
  WHERE to_regclass(format('public.%I', table_name)) IS NULL;

  IF cardinality(missing_tables) > 0 THEN
    RAISE EXCEPTION 'Missing required public tables: %', array_to_string(missing_tables, ', ');
  END IF;

  SELECT coalesce(array_agg(table_name ORDER BY table_name), ARRAY[]::text[])
  INTO missing_user_id_tables
  FROM unnest(required_tables) AS required(table_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = required.table_name
      AND column_name = 'user_id'
  );

  IF cardinality(missing_user_id_tables) > 0 THEN
    RAISE EXCEPTION 'Missing user_id column on public tables: %', array_to_string(missing_user_id_tables, ', ');
  END IF;

  SELECT coalesce(array_agg(table_name ORDER BY table_name), ARRAY[]::text[])
  INTO invalid_user_id_type_tables
  FROM unnest(required_tables) AS required(table_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = required.table_name
      AND column_name = 'user_id'
      AND udt_name = 'uuid'
  );

  IF cardinality(invalid_user_id_type_tables) > 0 THEN
    RAISE EXCEPTION 'user_id must be uuid on public tables: %', array_to_string(invalid_user_id_type_tables, ', ');
  END IF;

  SELECT coalesce(array_agg(c.relname ORDER BY c.relname), ARRAY[]::text[])
  INTO rls_disabled_tables
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = ANY(required_tables)
    AND c.relkind IN ('r', 'p')
    AND NOT c.relrowsecurity;

  IF cardinality(rls_disabled_tables) > 0 THEN
    RAISE EXCEPTION 'RLS must already be enabled on public tables: %', array_to_string(rls_disabled_tables, ', ');
  END IF;

  FOREACH target_table IN ARRAY required_tables LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE user_id IS NULL', target_table)
    INTO null_owner_count;

    IF null_owner_count > 0 THEN
      RAISE EXCEPTION 'public.% has % rows with user_id NULL.', target_table, null_owner_count;
    END IF;

    EXECUTE format(
      'SELECT count(*)
       FROM public.%I owned
       WHERE NOT EXISTS (
         SELECT 1
         FROM auth.users auth_user
         WHERE auth_user.id = owned.user_id
       )',
      target_table
    )
    INTO orphan_owner_count;

    IF orphan_owner_count > 0 THEN
      RAISE EXCEPTION 'public.% has % rows with user_id not present in auth.users.', target_table, orphan_owner_count;
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lecture_contact_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow authenticated all lectures" ON public.lectures;
DROP POLICY IF EXISTS "allow authenticated all todos" ON public.todos;
DROP POLICY IF EXISTS "allow authenticated all work_tasks" ON public.work_tasks;
DROP POLICY IF EXISTS "allow authenticated all sms_history" ON public.sms_history;
DROP POLICY IF EXISTS "allow authenticated all lecture_contact_logs" ON public.lecture_contact_logs;
DROP POLICY IF EXISTS "allow authenticated all instructor_profile" ON public.instructor_profile;

DROP POLICY IF EXISTS "Users can select own lectures" ON public.lectures;
DROP POLICY IF EXISTS "Users can insert own lectures" ON public.lectures;
DROP POLICY IF EXISTS "Users can update own lectures" ON public.lectures;
DROP POLICY IF EXISTS "Users can delete own lectures" ON public.lectures;

CREATE POLICY "Users can select own lectures"
  ON public.lectures
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own lectures"
  ON public.lectures
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own lectures"
  ON public.lectures
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own lectures"
  ON public.lectures
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can select own todos" ON public.todos;
DROP POLICY IF EXISTS "Users can insert own todos" ON public.todos;
DROP POLICY IF EXISTS "Users can update own todos" ON public.todos;
DROP POLICY IF EXISTS "Users can delete own todos" ON public.todos;

CREATE POLICY "Users can select own todos"
  ON public.todos
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own todos"
  ON public.todos
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own todos"
  ON public.todos
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own todos"
  ON public.todos
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can select own work_tasks" ON public.work_tasks;
DROP POLICY IF EXISTS "Users can insert own work_tasks" ON public.work_tasks;
DROP POLICY IF EXISTS "Users can update own work_tasks" ON public.work_tasks;
DROP POLICY IF EXISTS "Users can delete own work_tasks" ON public.work_tasks;

CREATE POLICY "Users can select own work_tasks"
  ON public.work_tasks
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own work_tasks"
  ON public.work_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own work_tasks"
  ON public.work_tasks
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own work_tasks"
  ON public.work_tasks
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can select own sms_history" ON public.sms_history;
DROP POLICY IF EXISTS "Users can insert own sms_history" ON public.sms_history;
DROP POLICY IF EXISTS "Users can update own sms_history" ON public.sms_history;
DROP POLICY IF EXISTS "Users can delete own sms_history" ON public.sms_history;

CREATE POLICY "Users can select own sms_history"
  ON public.sms_history
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own sms_history"
  ON public.sms_history
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own sms_history"
  ON public.sms_history
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own sms_history"
  ON public.sms_history
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can select own lecture_contact_logs" ON public.lecture_contact_logs;
DROP POLICY IF EXISTS "Users can insert own lecture_contact_logs" ON public.lecture_contact_logs;
DROP POLICY IF EXISTS "Users can update own lecture_contact_logs" ON public.lecture_contact_logs;
DROP POLICY IF EXISTS "Users can delete own lecture_contact_logs" ON public.lecture_contact_logs;

CREATE POLICY "Users can select own lecture_contact_logs"
  ON public.lecture_contact_logs
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own lecture_contact_logs"
  ON public.lecture_contact_logs
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own lecture_contact_logs"
  ON public.lecture_contact_logs
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own lecture_contact_logs"
  ON public.lecture_contact_logs
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can select own instructor_profile" ON public.instructor_profile;
DROP POLICY IF EXISTS "Users can insert own instructor_profile" ON public.instructor_profile;
DROP POLICY IF EXISTS "Users can update own instructor_profile" ON public.instructor_profile;
DROP POLICY IF EXISTS "Users can delete own instructor_profile" ON public.instructor_profile;

CREATE POLICY "Users can select own instructor_profile"
  ON public.instructor_profile
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own instructor_profile"
  ON public.instructor_profile
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own instructor_profile"
  ON public.instructor_profile
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own instructor_profile"
  ON public.instructor_profile
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

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
  target_cmd text;
  policy_count integer;
  invalid_policy_count integer;
  temporary_policy_count integer;
BEGIN
  FOREACH target_table IN ARRAY required_tables LOOP
    FOREACH target_cmd IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'] LOOP
      SELECT count(*)
      INTO policy_count
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = target_table
        AND cmd = target_cmd
        AND 'authenticated' = ANY(roles);

      IF policy_count < 1 THEN
        RAISE EXCEPTION 'Missing authenticated % policy on public.%', target_cmd, target_table;
      END IF;
    END LOOP;

    SELECT count(*)
    INTO invalid_policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = target_table
      AND (
        'anon' = ANY(roles)
        OR lower(regexp_replace(coalesce(qual, ''), '\s+', ' ', 'g')) IN ('true', '(true)')
        OR lower(regexp_replace(coalesce(with_check, ''), '\s+', ' ', 'g')) IN ('true', '(true)')
        OR (
          cmd IN ('SELECT', 'UPDATE', 'DELETE')
          AND NOT (
            lower(coalesce(qual, '')) LIKE '%user_id%'
            AND lower(coalesce(qual, '')) LIKE '%auth.uid%'
          )
        )
        OR (
          cmd IN ('INSERT', 'UPDATE')
          AND NOT (
            lower(coalesce(with_check, '')) LIKE '%user_id%'
            AND lower(coalesce(with_check, '')) LIKE '%auth.uid%'
          )
        )
      );

    IF invalid_policy_count > 0 THEN
      RAISE EXCEPTION 'Invalid owner policy shape found on public.%', target_table;
    END IF;

    SELECT count(*)
    INTO temporary_policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = target_table
      AND policyname = format('allow authenticated all %s', target_table);

    IF temporary_policy_count > 0 THEN
      RAISE EXCEPTION 'Temporary allow authenticated all policy still exists on public.%', target_table;
    END IF;
  END LOOP;
END $$;

COMMIT;
