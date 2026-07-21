-- 1) Fix OpenRouter secret env var name to match runtime.
UPDATE public.ai_providers SET secret_env_var = 'OPEN_ROUTER_API_KEY' WHERE slug = 'openrouter';

-- 2) Null out any ai_routes columns pointing at Lovable-hosted models.
WITH lovable_models AS (
  SELECT m.id FROM public.ai_models m
   JOIN public.ai_providers p ON p.id = m.provider_id
   WHERE p.slug IN ('lovable','google')
)
UPDATE public.ai_routes
   SET primary_model_id   = CASE WHEN primary_model_id   IN (SELECT id FROM lovable_models) THEN NULL ELSE primary_model_id   END,
       secondary_model_id = CASE WHEN secondary_model_id IN (SELECT id FROM lovable_models) THEN NULL ELSE secondary_model_id END,
       premium_model_id   = CASE WHEN premium_model_id   IN (SELECT id FROM lovable_models) THEN NULL ELSE premium_model_id   END,
       fallback_model_id  = CASE WHEN fallback_model_id  IN (SELECT id FROM lovable_models) THEN NULL ELSE fallback_model_id  END;

-- 3) Repoint secondary/premium tiers to OpenRouter models where empty.
WITH or_secondary AS (
  SELECT m.id FROM public.ai_models m JOIN public.ai_providers p ON p.id = m.provider_id
   WHERE p.slug = 'openrouter' AND m.model_id = 'google/gemini-flash-1.5-8b' LIMIT 1
),
or_premium AS (
  SELECT m.id FROM public.ai_models m JOIN public.ai_providers p ON p.id = m.provider_id
   WHERE p.slug = 'openrouter' AND m.model_id = 'google/gemini-2.5-flash' LIMIT 1
)
UPDATE public.ai_routes
   SET secondary_model_id = COALESCE(secondary_model_id, (SELECT id FROM or_secondary)),
       premium_model_id   = COALESCE(premium_model_id,   (SELECT id FROM or_premium));

-- 4) Disable Lovable-hosted models and providers.
UPDATE public.ai_models SET enabled = false
 WHERE provider_id IN (SELECT id FROM public.ai_providers WHERE slug IN ('lovable','google'));

UPDATE public.ai_providers SET enabled = false WHERE slug IN ('lovable','google');