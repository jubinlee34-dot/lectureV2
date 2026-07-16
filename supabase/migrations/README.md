# User Ownership Migrations

`20260716_01_add_user_ownership.sql` connects existing rows to one existing Supabase Auth user and finalizes the `user_id` constraints and indexes.

## Important Notes

- Do not run the root `migration.sql` or `supabase_schema.sql` against the production database again.
- Copy the migration SQL into the Supabase SQL Editor before running it.
- The migration SQL contains the placeholder exactly once.
- Replace that one `REPLACE_WITH_EXISTING_AUTH_USER_UUID` placeholder only in the SQL Editor copy that will be run.
- Do not commit real Auth UUIDs or emails to GitHub.
- Check the row counts for all target tables before running the migration.
- After running the migration, copy `20260716_01_verify_user_ownership.sql` into the SQL Editor, replace the same placeholder only in that SQL Editor copy, and review the results.
- This stage does not change RLS policies to `auth.uid() = user_id`.
- This repository change does not run the production database migration yet.

## Target Tables

- `public.lectures`
- `public.todos`
- `public.work_tasks`
- `public.sms_history`
- `public.lecture_contact_logs`
- `public.instructor_profile`

## Post-run Verification

The verification SQL checks the target Auth user, row counts, `user_id` fill status, type and default, `NOT NULL`, foreign keys, indexes, RLS enabled status, and the current authenticated / ALL / true policy shape using read-only statements.

## Final RLS Policy Migration

After the ownership columns, backfill, constraints, and indexes are verified in production, apply the final user-owned RLS migration in this order:

1. Back up the Production DB or record current row counts for the target tables.
2. Copy `20260716_02_enforce_user_ownership_rls.sql` into the Supabase SQL Editor and run the whole file.
3. Confirm the SQL Editor reports success.
4. Do not repeatedly run the same migration after it succeeds.
5. Run `20260716_02_verify_user_ownership_rls.sql`.
6. Test CRUD in the app with the existing Auth account.
7. Test isolation with a second Auth test account.
8. Stop the PR merge if any verification result or app test is unexpected.

If the migration fails, diagnose the error before trying again. Do not record real Auth UUIDs in code, SQL files, README notes, issues, or PR comments. Do not use a `service_role` key in the browser. Do not run the old root `migration.sql` or `supabase_schema.sql` against Production.

The verify SQL is read-only. Expected results are:

- Every target table has `rls_enabled = true`.
- `null_owner_count = 0`.
- `orphan_owner_count = 0`.
- Every target table has authenticated SELECT, INSERT, UPDATE, and DELETE policies.
- `USING true`, `WITH CHECK true`, anon policies, and temporary `allow authenticated all ...` policies are all absent.

After the policy switch, logged-in users cannot see or modify rows owned by another Auth user. The two-account isolation check should confirm each account only sees its own lectures, todos, work tasks, SMS history, contact logs, and instructor profile.
