
ALTER TABLE public.ai_providers
  ADD COLUMN IF NOT EXISTS encrypted_api_key text,
  ADD COLUMN IF NOT EXISTS api_key_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS api_key_updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
