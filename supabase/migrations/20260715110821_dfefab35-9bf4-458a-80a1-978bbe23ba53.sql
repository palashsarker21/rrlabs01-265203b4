-- Fix ON CONFLICT target for public.integrations.
-- The previous UNIQUE index used COALESCE(provider_account_id, id::text) as an
-- expression, which cannot be referenced by ON CONFLICT (workspace_id, kind,
-- provider, provider_account_id) and caused:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- Replace it with a plain unique index using NULLS NOT DISTINCT (PG15+),
-- which matches the client-side onConflict spec exactly.

DROP INDEX IF EXISTS public.integrations_workspace_provider_account_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS integrations_workspace_kind_provider_account_uidx
  ON public.integrations (workspace_id, kind, provider, provider_account_id)
  NULLS NOT DISTINCT;
