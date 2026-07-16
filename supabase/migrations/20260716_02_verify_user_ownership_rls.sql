-- Read-only verification for user-owned RLS.
-- Expected:
-- - rls_enabled = true for every target table
-- - null_owner_count = 0
-- - orphan_owner_count = 0
-- - authenticated SELECT/INSERT/UPDATE/DELETE policies exist for every table
-- - using_true = false
-- - with_check_true = false
-- - has_anon_policy = false
-- - temporary_allow_authenticated_all_policy = false

WITH target_tables(table_name) AS (
  VALUES
    ('lectures'),
    ('todos'),
    ('work_tasks'),
    ('sms_history'),
    ('lecture_contact_logs'),
    ('instructor_profile')
),
table_status AS (
  SELECT
    target_tables.table_name,
    c.relrowsecurity AS rls_enabled
  FROM target_tables
  JOIN pg_class c ON c.oid = format('public.%I', target_tables.table_name)::regclass
)
SELECT
  table_status.table_name,
  table_status.rls_enabled,
  null_counts.null_owner_count,
  orphan_counts.orphan_owner_count
FROM table_status
CROSS JOIN LATERAL (
  SELECT count(*) AS null_owner_count
  FROM (
    SELECT 1
    FROM public.lectures
    WHERE table_status.table_name = 'lectures'
      AND user_id IS NULL
    UNION ALL
    SELECT 1
    FROM public.todos
    WHERE table_status.table_name = 'todos'
      AND user_id IS NULL
    UNION ALL
    SELECT 1
    FROM public.work_tasks
    WHERE table_status.table_name = 'work_tasks'
      AND user_id IS NULL
    UNION ALL
    SELECT 1
    FROM public.sms_history
    WHERE table_status.table_name = 'sms_history'
      AND user_id IS NULL
    UNION ALL
    SELECT 1
    FROM public.lecture_contact_logs
    WHERE table_status.table_name = 'lecture_contact_logs'
      AND user_id IS NULL
    UNION ALL
    SELECT 1
    FROM public.instructor_profile
    WHERE table_status.table_name = 'instructor_profile'
      AND user_id IS NULL
  ) rows_with_null_owner
) null_counts
CROSS JOIN LATERAL (
  SELECT count(*) AS orphan_owner_count
  FROM (
    SELECT lectures.user_id
    FROM public.lectures
    WHERE table_status.table_name = 'lectures'
    UNION ALL
    SELECT todos.user_id
    FROM public.todos
    WHERE table_status.table_name = 'todos'
    UNION ALL
    SELECT work_tasks.user_id
    FROM public.work_tasks
    WHERE table_status.table_name = 'work_tasks'
    UNION ALL
    SELECT sms_history.user_id
    FROM public.sms_history
    WHERE table_status.table_name = 'sms_history'
    UNION ALL
    SELECT lecture_contact_logs.user_id
    FROM public.lecture_contact_logs
    WHERE table_status.table_name = 'lecture_contact_logs'
    UNION ALL
    SELECT instructor_profile.user_id
    FROM public.instructor_profile
    WHERE table_status.table_name = 'instructor_profile'
  ) owned_rows
  WHERE NOT EXISTS (
    SELECT 1
    FROM auth.users auth_user
    WHERE auth_user.id = owned_rows.user_id
  )
) orphan_counts
ORDER BY table_status.table_name;

WITH target_tables(table_name) AS (
  VALUES
    ('lectures'),
    ('todos'),
    ('work_tasks'),
    ('sms_history'),
    ('lecture_contact_logs'),
    ('instructor_profile')
)
SELECT
  target_tables.table_name,
  pg_policies.policyname,
  pg_policies.roles,
  pg_policies.cmd,
  pg_policies.qual,
  pg_policies.with_check,
  'authenticated' = ANY(pg_policies.roles) AS targets_authenticated,
  lower(regexp_replace(coalesce(pg_policies.qual, ''), '\s+', ' ', 'g')) IN ('true', '(true)') AS using_true,
  lower(regexp_replace(coalesce(pg_policies.with_check, ''), '\s+', ' ', 'g')) IN ('true', '(true)') AS with_check_true,
  'anon' = ANY(pg_policies.roles) AS has_anon_policy,
  pg_policies.policyname = format('allow authenticated all %s', target_tables.table_name) AS temporary_allow_authenticated_all_policy
FROM target_tables
LEFT JOIN pg_policies
  ON pg_policies.schemaname = 'public'
 AND pg_policies.tablename = target_tables.table_name
ORDER BY target_tables.table_name, pg_policies.cmd, pg_policies.policyname;

WITH target_tables(table_name) AS (
  VALUES
    ('lectures'),
    ('todos'),
    ('work_tasks'),
    ('sms_history'),
    ('lecture_contact_logs'),
    ('instructor_profile')
),
policy_summary AS (
  SELECT
    target_tables.table_name,
    count(*) FILTER (WHERE pg_policies.cmd = 'SELECT' AND 'authenticated' = ANY(pg_policies.roles)) AS authenticated_select_policy_count,
    count(*) FILTER (WHERE pg_policies.cmd = 'INSERT' AND 'authenticated' = ANY(pg_policies.roles)) AS authenticated_insert_policy_count,
    count(*) FILTER (WHERE pg_policies.cmd = 'UPDATE' AND 'authenticated' = ANY(pg_policies.roles)) AS authenticated_update_policy_count,
    count(*) FILTER (WHERE pg_policies.cmd = 'DELETE' AND 'authenticated' = ANY(pg_policies.roles)) AS authenticated_delete_policy_count,
    bool_or(lower(regexp_replace(coalesce(pg_policies.qual, ''), '\s+', ' ', 'g')) IN ('true', '(true)')) AS has_using_true,
    bool_or(lower(regexp_replace(coalesce(pg_policies.with_check, ''), '\s+', ' ', 'g')) IN ('true', '(true)')) AS has_with_check_true,
    bool_or('anon' = ANY(pg_policies.roles)) AS has_anon_policy,
    bool_or(pg_policies.policyname = format('allow authenticated all %s', target_tables.table_name)) AS temporary_allow_authenticated_all_policy
  FROM target_tables
  LEFT JOIN pg_policies
    ON pg_policies.schemaname = 'public'
   AND pg_policies.tablename = target_tables.table_name
  GROUP BY target_tables.table_name
)
SELECT
  table_name,
  authenticated_select_policy_count,
  authenticated_insert_policy_count,
  authenticated_update_policy_count,
  authenticated_delete_policy_count,
  coalesce(has_using_true, false) AS has_using_true,
  coalesce(has_with_check_true, false) AS has_with_check_true,
  coalesce(has_anon_policy, false) AS has_anon_policy,
  coalesce(temporary_allow_authenticated_all_policy, false) AS temporary_allow_authenticated_all_policy,
  authenticated_select_policy_count >= 1
    AND authenticated_insert_policy_count >= 1
    AND authenticated_update_policy_count >= 1
    AND authenticated_delete_policy_count >= 1
    AND NOT coalesce(has_using_true, false)
    AND NOT coalesce(has_with_check_true, false)
    AND NOT coalesce(has_anon_policy, false)
    AND NOT coalesce(temporary_allow_authenticated_all_policy, false) AS expected_policy_state
FROM policy_summary
ORDER BY table_name;
