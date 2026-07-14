
ALTER TYPE workspace_status ADD VALUE IF NOT EXISTS 'trial';
ALTER TYPE workspace_status ADD VALUE IF NOT EXISTS 'expired';
ALTER TYPE workspace_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE workspace_status ADD VALUE IF NOT EXISTS 'archived';
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS trial_started_at timestamptz;
