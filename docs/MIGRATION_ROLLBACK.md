# Rollback (down) migrations

Every forward migration in `supabase/migrations/` should ship with a paired
rollback script under `scripts/ci/rollback/` so the CI pipeline can perform
an automated safe backout when `supabase db push` fails or a post-migration
check (schema drift, RLS, smoke tests) fails.

## Convention

- Store rollback files at `scripts/ci/rollback/<timestamp>_<name>.sql`.
- Same 14-digit timestamp prefix as the forward migration in
  `supabase/migrations/`.
- Contents: idempotent SQL that fully reverses the forward migration.
  - `DROP TABLE IF EXISTS …`
  - `ALTER TABLE … DROP COLUMN IF EXISTS …`
  - `DROP POLICY IF EXISTS …`
  - `DROP FUNCTION IF EXISTS … CASCADE;`
  - Restore any prior definitions (`CREATE OR REPLACE FUNCTION …`) that the
    forward migration overwrote.
- Do **not** wrap the file in `BEGIN; … COMMIT;` — the runner already applies
  it with `psql --single-transaction --set ON_ERROR_STOP=1`.

## How it is used

1. Before `supabase db push`, CI captures the list of already-applied
   migration versions and a full `pg_dump --schema-only` snapshot (uploaded
   as the `pre-migration-snapshot` workflow artifact, retained 30 days).
2. On any failure in the `migrate` or `post-migrate-validate` jobs the
   rollback step runs `scripts/ci/rollback-migrations.sh`, which:
   - Diffs remote migration state before vs after,
   - Applies each newly-committed migration's rollback file in **reverse**
     order via `psql --single-transaction --set ON_ERROR_STOP=1`,
   - Calls `supabase migration repair --status reverted <version>` so the
     next `db push` can re-apply the corrected forward file.
3. If a newly-applied migration has **no** rollback file, automatic rollback
   aborts in strict mode, the pre-migration schema dump is left as a workflow
   artifact, and the deployment is marked as needing manual intervention.

## Data-destructive changes

Automated rollback restores **schema**, not deleted rows. For any migration
that drops a column/table or rewrites data, either:

- take a data snapshot inside the forward migration (e.g. copy rows to a
  `_backup_<timestamp>` table) and restore from it in the down script, or
- flag the migration as non-reversible in its header comment and coordinate
  a manual maintenance window.

## Toggles

- `STRICT=0` in the workflow env allows rollback to proceed even when some
  new migrations lack a paired down script (they're skipped, only the
  bookkeeping row is cleared). Default is `STRICT=1`.
