# Archived Migrations (pre-baseline)

This directory holds the Supabase migration files that were under
`supabase/migrations/` before `20260817000000_baseline_current_state.sql`
was introduced. They are kept here **only as a historical record**, stored
outside `supabase/migrations/` to separate them from the Supabase CLI's
migration target directory.

## Why these were archived

Replaying these 16 files in order against a fresh database is not reliable:
`20260716_02_enforce_user_ownership_rls.sql` never drops the `anon_all_*`
policies created earlier by `repair_lectures_schema.sql` /
`20260622...` / `20260629000100_add_lecture_contact_logs.sql`, which makes
the precondition check in `20260809000100_remove_anon_grants_dedupe_contact_fk.sql`
fail when replayed from scratch. In other words, the set only works when
applied in the exact historical order against the exact database state each
one was originally run against — it is not reproducible from a clean
database. This is the order-dependency bug referenced internally as E-5.

## What replaced them

`supabase/migrations/20260817000000_baseline_current_state.sql` was
originally authored by reconstructing the current production schema from
read-only `pg_catalog` / `information_schema` queries against the linked
remote project (Docker was unavailable in the authoring environment, so
`supabase db dump` could not be used). It was separately verified by running
the file against an empty local Docker database and inspecting the
resulting schema via `pg_catalog` / `information_schema`. It supersedes
every file in this archive as the starting point for the migration history
going forward.

## Status

These files are preserved for historical reference only. Do not run them
against any database, and do not treat them as an accurate replay path for
recreating the schema — use the baseline migration instead.
