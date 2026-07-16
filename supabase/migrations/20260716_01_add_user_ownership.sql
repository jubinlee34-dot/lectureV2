BEGIN;

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
  IF owner_id_text = 'REPLACE_WITH_EXISTING_AUTH_USER_UUID' THEN
    RAISE EXCEPTION
      'Replace REPLACE_WITH_EXISTING_AUTH_USER_UUID with an existing auth.users id before running this migration.';
  END IF;

  owner_id := owner_id_text::uuid;

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
END $$;

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

COMMIT;
