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