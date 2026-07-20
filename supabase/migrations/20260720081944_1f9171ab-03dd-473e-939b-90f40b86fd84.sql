
-- Add consent + communication preference columns to profiles (all nullable, backward compatible)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS accepted_terms_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_privacy_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_data_processing_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_service_comms_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_version text,
  ADD COLUMN IF NOT EXISTS consent_ip inet,
  ADD COLUMN IF NOT EXISTS consent_user_agent text,
  ADD COLUMN IF NOT EXISTS service_notifications_opt_in boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS marketing_email_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_notifications_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_notifications_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS product_updates_opt_in boolean NOT NULL DEFAULT false;

-- Extend the new-user trigger to persist consent + preferences from signup metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  _now  timestamptz := now();
  _full text := COALESCE(_meta->>'full_name', _meta->>'display_name', _meta->>'name');
BEGIN
  INSERT INTO public.profiles (
    id, email, display_name, avatar_url, full_name,
    accepted_terms_at, accepted_privacy_at, accepted_data_processing_at, accepted_service_comms_at,
    consent_version, consent_user_agent,
    marketing_email_opt_in, whatsapp_notifications_opt_in,
    sms_notifications_opt_in, product_updates_opt_in
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(_full, split_part(NEW.email, '@', 1)),
    _meta->>'avatar_url',
    _full,
    CASE WHEN (_meta->>'accepted_terms')::boolean IS TRUE THEN _now END,
    CASE WHEN (_meta->>'accepted_privacy')::boolean IS TRUE THEN _now END,
    CASE WHEN (_meta->>'accepted_data_processing')::boolean IS TRUE THEN _now END,
    CASE WHEN (_meta->>'accepted_service_comms')::boolean IS TRUE THEN _now END,
    COALESCE(_meta->>'consent_version', '2026-01'),
    _meta->>'consent_user_agent',
    COALESCE((_meta->>'marketing_email_opt_in')::boolean, false),
    COALESCE((_meta->>'whatsapp_notifications_opt_in')::boolean, false),
    COALESCE((_meta->>'sms_notifications_opt_in')::boolean, false),
    COALESCE((_meta->>'product_updates_opt_in')::boolean, false)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;
