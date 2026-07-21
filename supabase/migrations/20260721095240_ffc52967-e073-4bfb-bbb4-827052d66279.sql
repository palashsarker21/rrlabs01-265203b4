-- New defaults: 4 attempts with gaps of 2h / 24h / 72h between them.
ALTER TABLE public.workspace_automation_settings
  ALTER COLUMN max_retries SET DEFAULT 4,
  ALTER COLUMN retry_schedule_minutes SET DEFAULT ARRAY[120, 1440, 4320];

-- Migrate rows still on the previous defaults so existing workspaces
-- immediately benefit from the new enterprise cadence.
UPDATE public.workspace_automation_settings
   SET retry_schedule_minutes = ARRAY[120, 1440, 4320],
       max_retries = 4
 WHERE retry_schedule_minutes = ARRAY[15, 1440, 2880]
   AND max_retries IN (2, 3);
