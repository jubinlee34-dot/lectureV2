BEGIN;

CREATE TEMP TABLE user_ownership_target (
  user_id uuid PRIMARY KEY
) ON COMMIT DROP;

DO $$
DECLARE
  owner_id_text text := 'REPLACE_WITH_EXISTING_AUTH_USER_UUID';
  owner_id uuid;
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
  BEGIN
    owner_id := owner_id_text::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Enter an existing Supabase Auth user UUID before running this migration.';
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = owner_id
  ) THEN
    RAISE EXCEPTION 'auth.users id % does not exist.', owner_id;
  END IF;

  SELECT coalesce(array_agg(table_name ORDER BY table_name), ARRAY[]::text[])
  INTO missing_tables
  FROM unnest(required_tables) AS table_name
  WHERE to_regclass(format('public.%I', table_name)) IS NULL;

  IF cardinality(missing_tables) > 0 THEN
    RAISE EXCEPTION 'Missing required public tables: %', array_to_string(missing_tables, ', ');
  END IF;

  INSERT INTO user_ownership_target (user_id)
  VALUES (owner_id);
END $$;

CREATE TEMP TABLE user_ownership_row_counts_before (
  table_name text PRIMARY KEY,
  row_count bigint NOT NULL
) ON COMMIT DROP;

INSERT INTO user_ownership_row_counts_before (table_name, row_count)
SELECT 'lectures', count(*) FROM public.lectures
UNION ALL
SELECT 'todos', count(*) FROM public.todos
UNION ALL
SELECT 'work_tasks', count(*) FROM public.work_tasks
UNION ALL
SELECT 'sms_history', count(*) FROM public.sms_history
UNION ALL
SELECT 'lecture_contact_logs', count(*) FROM public.lecture_contact_logs
UNION ALL
SELECT 'instructor_profile', count(*) FROM public.instructor_profile;

ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();

ALTER TABLE public.todos
  ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();

ALTER TABLE public.work_tasks
  ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();

ALTER TABLE public.sms_history
  ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();

ALTER TABLE public.lecture_contact_logs
  ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();

ALTER TABLE public.instructor_profile
  ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();

ALTER TABLE public.lectures
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.todos
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.work_tasks
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.sms_history
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.lecture_contact_logs
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.instructor_profile
  ALTER COLUMN user_id SET DEFAULT auth.uid();

DO $$
DECLARE
  owner_id uuid;
  target_table text;
  conflicting_count bigint;
BEGIN
  SELECT user_id
  INTO owner_id
  FROM user_ownership_target;

  FOREACH target_table IN ARRAY ARRAY[
    'lectures',
    'todos',
    'work_tasks',
    'sms_history',
    'lecture_contact_logs',
    'instructor_profile'
  ] LOOP
    EXECUTE format(
      'SELECT count(*) FROM public.%I WHERE user_id IS NOT NULL AND user_id <> $1',
      target_table
    )
    INTO conflicting_count
    USING owner_id;

    IF conflicting_count > 0 THEN
      RAISE EXCEPTION
        'Found % rows in public.% with a user_id different from the target owner.',
        conflicting_count,
        target_table;
    END IF;
  END LOOP;
END $$;

UPDATE public.lectures
SET user_id = (SELECT user_id FROM user_ownership_target)
WHERE user_id IS NULL;

UPDATE public.todos
SET user_id = (SELECT user_id FROM user_ownership_target)
WHERE user_id IS NULL;

UPDATE public.work_tasks
SET user_id = (SELECT user_id FROM user_ownership_target)
WHERE user_id IS NULL;

UPDATE public.sms_history
SET user_id = (SELECT user_id FROM user_ownership_target)
WHERE user_id IS NULL;

UPDATE public.lecture_contact_logs
SET user_id = (SELECT user_id FROM user_ownership_target)
WHERE user_id IS NULL;

UPDATE public.instructor_profile
SET user_id = (SELECT user_id FROM user_ownership_target)
WHERE user_id IS NULL;

DO $$
DECLARE
  target_table text;
  null_count bigint;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'lectures',
    'todos',
    'work_tasks',
    'sms_history',
    'lecture_contact_logs',
    'instructor_profile'
  ] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE user_id IS NULL', target_table)
    INTO null_count;

    IF null_count > 0 THEN
      RAISE EXCEPTION 'public.% still has % rows with user_id NULL.', target_table, null_count;
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.lectures
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.todos
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.work_tasks
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.sms_history
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.lecture_contact_logs
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.instructor_profile
  ALTER COLUMN user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lectures_user_id_fkey'
      AND conrelid = 'public.lectures'::regclass
  ) THEN
    ALTER TABLE public.lectures
      ADD CONSTRAINT lectures_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'todos_user_id_fkey'
      AND conrelid = 'public.todos'::regclass
  ) THEN
    ALTER TABLE public.todos
      ADD CONSTRAINT todos_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'work_tasks_user_id_fkey'
      AND conrelid = 'public.work_tasks'::regclass
  ) THEN
    ALTER TABLE public.work_tasks
      ADD CONSTRAINT work_tasks_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sms_history_user_id_fkey'
      AND conrelid = 'public.sms_history'::regclass
  ) THEN
    ALTER TABLE public.sms_history
      ADD CONSTRAINT sms_history_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lecture_contact_logs_user_id_fkey'
      AND conrelid = 'public.lecture_contact_logs'::regclass
  ) THEN
    ALTER TABLE public.lecture_contact_logs
      ADD CONSTRAINT lecture_contact_logs_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'instructor_profile_user_id_fkey'
      AND conrelid = 'public.instructor_profile'::regclass
  ) THEN
    ALTER TABLE public.instructor_profile
      ADD CONSTRAINT instructor_profile_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS lectures_user_id_idx
  ON public.lectures (user_id);

CREATE INDEX IF NOT EXISTS todos_user_id_idx
  ON public.todos (user_id);

CREATE INDEX IF NOT EXISTS work_tasks_user_id_idx
  ON public.work_tasks (user_id);

CREATE INDEX IF NOT EXISTS sms_history_user_id_idx
  ON public.sms_history (user_id);

CREATE INDEX IF NOT EXISTS lecture_contact_logs_user_id_idx
  ON public.lecture_contact_logs (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS instructor_profile_user_id_unique
  ON public.instructor_profile (user_id);

DO $$
DECLARE
  target_table text;
  before_count bigint;
  after_count bigint;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'lectures',
    'todos',
    'work_tasks',
    'sms_history',
    'lecture_contact_logs',
    'instructor_profile'
  ] LOOP
    SELECT row_count
    INTO before_count
    FROM user_ownership_row_counts_before counts
    WHERE counts.table_name = target_table;

    EXECUTE format('SELECT count(*) FROM public.%I', target_table)
    INTO after_count;

    IF before_count <> after_count THEN
      RAISE EXCEPTION
        'Row count changed for public.%: before %, after %.',
        target_table,
        before_count,
        after_count;
    END IF;
  END LOOP;
END $$;

COMMIT;