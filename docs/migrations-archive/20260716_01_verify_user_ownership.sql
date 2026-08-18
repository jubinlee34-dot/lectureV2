WITH target_owner AS (
  SELECT 'REPLACE_WITH_EXISTING_AUTH_USER_UUID'::uuid AS user_id
)
SELECT
  'target_auth_user_exists' AS check_name,
  'auth.users' AS object_name,
  EXISTS (
    SELECT 1
    FROM auth.users users
    JOIN target_owner target ON users.id = target.user_id
  )::text AS result;

WITH target_owner AS (
  SELECT 'REPLACE_WITH_EXISTING_AUTH_USER_UUID'::uuid AS user_id
), ownership_counts AS (
  SELECT 'lectures' AS table_name, count(*) AS total_rows, count(*) FILTER (WHERE user_id IS NULL) AS null_user_id_rows, count(*) FILTER (WHERE user_id = (SELECT user_id FROM target_owner)) AS target_user_id_rows, count(*) FILTER (WHERE user_id IS NOT NULL AND user_id <> (SELECT user_id FROM target_owner)) AS other_user_id_rows FROM public.lectures
  UNION ALL
  SELECT 'todos', count(*), count(*) FILTER (WHERE user_id IS NULL), count(*) FILTER (WHERE user_id = (SELECT user_id FROM target_owner)), count(*) FILTER (WHERE user_id IS NOT NULL AND user_id <> (SELECT user_id FROM target_owner)) FROM public.todos
  UNION ALL
  SELECT 'work_tasks', count(*), count(*) FILTER (WHERE user_id IS NULL), count(*) FILTER (WHERE user_id = (SELECT user_id FROM target_owner)), count(*) FILTER (WHERE user_id IS NOT NULL AND user_id <> (SELECT user_id FROM target_owner)) FROM public.work_tasks
  UNION ALL
  SELECT 'sms_history', count(*), count(*) FILTER (WHERE user_id IS NULL), count(*) FILTER (WHERE user_id = (SELECT user_id FROM target_owner)), count(*) FILTER (WHERE user_id IS NOT NULL AND user_id <> (SELECT user_id FROM target_owner)) FROM public.sms_history
  UNION ALL
  SELECT 'lecture_contact_logs', count(*), count(*) FILTER (WHERE user_id IS NULL), count(*) FILTER (WHERE user_id = (SELECT user_id FROM target_owner)), count(*) FILTER (WHERE user_id IS NOT NULL AND user_id <> (SELECT user_id FROM target_owner)) FROM public.lecture_contact_logs
  UNION ALL
  SELECT 'instructor_profile', count(*), count(*) FILTER (WHERE user_id IS NULL), count(*) FILTER (WHERE user_id = (SELECT user_id FROM target_owner)), count(*) FILTER (WHERE user_id IS NOT NULL AND user_id <> (SELECT user_id FROM target_owner)) FROM public.instructor_profile
)
SELECT
  table_name,
  total_rows,
  null_user_id_rows,
  target_user_id_rows,
  other_user_id_rows
FROM ownership_counts
ORDER BY table_name;

WITH required_tables AS (
  SELECT *
  FROM (VALUES
    ('lectures'),
    ('todos'),
    ('work_tasks'),
    ('sms_history'),
    ('lecture_contact_logs'),
    ('instructor_profile')
  ) AS tables(table_name)
)
SELECT
  required.table_name,
  columns.data_type AS user_id_data_type,
  columns.udt_name AS user_id_udt_name,
  columns.column_default AS user_id_default,
  columns.column_default = 'auth.uid()' AS user_id_default_is_auth_uid,
  columns.is_nullable = 'NO' AS user_id_is_not_nullable
FROM required_tables required
LEFT JOIN information_schema.columns columns
  ON columns.table_schema = 'public'
 AND columns.table_name = required.table_name
 AND columns.column_name = 'user_id'
ORDER BY required.table_name;

WITH required_tables AS (
  SELECT *
  FROM (VALUES
    ('lectures', 'lectures_user_id_fkey'),
    ('todos', 'todos_user_id_fkey'),
    ('work_tasks', 'work_tasks_user_id_fkey'),
    ('sms_history', 'sms_history_user_id_fkey'),
    ('lecture_contact_logs', 'lecture_contact_logs_user_id_fkey'),
    ('instructor_profile', 'instructor_profile_user_id_fkey')
  ) AS tables(table_name, constraint_name)
)
SELECT
  required.table_name,
  constraints.conname AS foreign_key_name,
  constraints.confrelid = 'auth.users'::regclass AS references_auth_users,
  constraints.confdeltype AS delete_action_code
FROM required_tables required
LEFT JOIN pg_constraint constraints
  ON constraints.conrelid = format('public.%I', required.table_name)::regclass
 AND constraints.conname = required.constraint_name
 AND constraints.contype = 'f'
ORDER BY required.table_name;

WITH required_indexes AS (
  SELECT *
  FROM (VALUES
    ('lectures', 'lectures_user_id_idx'),
    ('todos', 'todos_user_id_idx'),
    ('work_tasks', 'work_tasks_user_id_idx'),
    ('sms_history', 'sms_history_user_id_idx'),
    ('lecture_contact_logs', 'lecture_contact_logs_user_id_idx'),
    ('instructor_profile', 'instructor_profile_user_id_unique')
  ) AS indexes(table_name, index_name)
)
SELECT
  required.table_name,
  required.index_name,
  indexes.indexname IS NOT NULL AS index_exists,
  indexes.indexdef
FROM required_indexes required
LEFT JOIN pg_indexes indexes
  ON indexes.schemaname = 'public'
 AND indexes.tablename = required.table_name
 AND indexes.indexname = required.index_name
ORDER BY required.table_name;

WITH required_tables AS (
  SELECT *
  FROM (VALUES
    ('lectures'),
    ('todos'),
    ('work_tasks'),
    ('sms_history'),
    ('lecture_contact_logs'),
    ('instructor_profile')
  ) AS tables(table_name)
)
SELECT
  required.table_name,
  pg_class.relrowsecurity AS rls_enabled
FROM required_tables required
JOIN pg_class
  ON pg_class.oid = format('public.%I', required.table_name)::regclass
ORDER BY required.table_name;

WITH required_tables AS (
  SELECT *
  FROM (VALUES
    ('lectures'),
    ('todos'),
    ('work_tasks'),
    ('sms_history'),
    ('lecture_contact_logs'),
    ('instructor_profile')
  ) AS tables(table_name)
)
SELECT
  required.table_name,
  policies.policyname,
  policies.roles,
  policies.cmd,
  policies.qual,
  policies.with_check,
  'authenticated' = ANY (policies.roles) AS applies_to_authenticated,
  policies.cmd = 'ALL' AS applies_to_all_commands,
  coalesce(policies.qual, '') IN ('true', '(true)') AS using_is_true,
  coalesce(policies.with_check, '') IN ('true', '(true)') AS check_is_true
FROM required_tables required
LEFT JOIN pg_policies policies
  ON policies.schemaname = 'public'
 AND policies.tablename = required.table_name
ORDER BY required.table_name, policies.policyname;
