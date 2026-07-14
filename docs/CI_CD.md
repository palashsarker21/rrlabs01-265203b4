# Production CI/CD — Supabase Migrations & App Deploy

`/.github/workflows/deploy.yml` runs on every push to `main` and on manual
dispatch. It gates deployment behind seven phases; any failure stops the
pipeline before production is touched.

## Required GitHub Secrets

| Secret                      | Purpose                                                 |
| --------------------------- | ------------------------------------------------------- |
| `SUPABASE_PROJECT_REF`      | Target project ref (e.g. `abcdxyz`).                    |
| `SUPABASE_ACCESS_TOKEN`     | Personal access token for the Supabase CLI (`sbp_...`). |
| `SUPABASE_DB_PASSWORD`      | Database password used by `supabase link` / `db push`.  |
| `SUPABASE_URL`              | `https://<ref>.supabase.co`.                            |
| `SUPABASE_PUBLISHABLE_KEY`  | Anon / publishable API key (safe in client bundles).    |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server only; never logged).           |
| `DATABASE_URL`              | Optional pooled Postgres URL for ad-hoc checks.         |

## Phases

1. **Verify** – asserts secrets, links the CLI, confirms connectivity.
2. **App validate** – installs deps, validates migration filenames, lints,
   typechecks, builds.
3. **Migrate** – `supabase db push --linked` applies pending migrations
   transactionally, in timestamp order. A failure halts the workflow.
4. **Schema + Security** – `supabase db diff` detects drift; `psql`
   executes `scripts/ci/security-checks.sql` to enforce RLS, block anon
   writes, and require `SECURITY DEFINER` functions to pin `search_path`.
5. **Deploy** – runs only after every previous gate passes.

## Adding a migration

1. Create a new file: `supabase/migrations/<UTC timestamp>_<slug>.sql`.
2. Never edit an already-applied migration — add a new one.
3. Commit and push to `main`. The workflow applies it automatically.

## Local reproduction

```bash
bash scripts/ci/validate-migrations.sh
supabase link --project-ref "$SUPABASE_PROJECT_REF" --password "$SUPABASE_DB_PASSWORD"
supabase migration list --linked
supabase db push --linked
```
