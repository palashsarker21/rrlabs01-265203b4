
-- Align provider_catalog.setup_fields with server adapter keys.
UPDATE public.provider_catalog SET setup_fields = '[
  {"key":"store_url","label":"Store URL","placeholder":"https://my-store.myshopify.com","type":"url","required":true},
  {"key":"admin_access_token","label":"Admin API Access Token","type":"password","required":true},
  {"key":"api_version","label":"API Version","placeholder":"2024-10","type":"text","required":false},
  {"key":"webhook_secret","label":"Webhook Signing Secret","type":"password","required":false}
]'::jsonb WHERE code = 'shopify';

UPDATE public.provider_catalog SET setup_fields = '[
  {"key":"store_url","label":"Store URL","placeholder":"https://example.com","type":"url","required":true},
  {"key":"consumer_key","label":"Consumer Key","type":"password","required":true},
  {"key":"consumer_secret","label":"Consumer Secret","type":"password","required":true},
  {"key":"webhook_secret","label":"Webhook Secret","type":"password","required":false}
]'::jsonb WHERE code = 'woocommerce';

UPDATE public.provider_catalog SET setup_fields = '[
  {"key":"store_name","label":"Store Name","type":"text","required":true},
  {"key":"base_url","label":"API Base URL","placeholder":"https://api.example.com","type":"url","required":true},
  {"key":"api_key","label":"API Key","type":"password","required":true},
  {"key":"auth_type","label":"Auth Type","type":"select","options":["bearer","api_key","basic"],"required":true},
  {"key":"webhook_endpoint","label":"Webhook Endpoint (optional)","type":"url","required":false},
  {"key":"webhook_secret","label":"Webhook Secret","type":"password","required":false}
]'::jsonb WHERE code = 'custom_store';

UPDATE public.provider_catalog SET setup_fields = '[
  {"key":"secret_key","label":"Secret Key","placeholder":"sk_live_...","type":"password","required":true},
  {"key":"publishable_key","label":"Publishable Key","placeholder":"pk_live_...","type":"text","required":false},
  {"key":"webhook_secret","label":"Webhook Signing Secret","placeholder":"whsec_...","type":"password","required":false}
]'::jsonb WHERE code = 'stripe';

UPDATE public.provider_catalog SET setup_fields = '[
  {"key":"api_key","label":"API Key","type":"password","required":true},
  {"key":"environment","label":"Environment","type":"select","options":["live","sandbox"],"required":true},
  {"key":"webhook_secret","label":"Webhook Secret","type":"password","required":false}
]'::jsonb WHERE code = 'paddle';

UPDATE public.provider_catalog SET setup_fields = '[
  {"key":"client_id","label":"Client ID","type":"text","required":true},
  {"key":"client_secret","label":"Client Secret","type":"password","required":true},
  {"key":"environment","label":"Environment","type":"select","options":["sandbox","live"],"required":true}
]'::jsonb WHERE code = 'paypal';

UPDATE public.provider_catalog SET setup_fields = '[
  {"key":"api_key","label":"API Key","type":"password","required":true},
  {"key":"merchant_account","label":"Merchant Account","type":"text","required":true},
  {"key":"environment","label":"Environment","type":"select","options":["test","live"],"required":true},
  {"key":"hmac_key","label":"HMAC Key","type":"password","required":false}
]'::jsonb WHERE code = 'adyen';

UPDATE public.provider_catalog SET setup_fields = '[
  {"key":"api_key","label":"API Key","type":"password","required":true},
  {"key":"store_id","label":"Store ID","type":"text","required":true},
  {"key":"webhook_secret","label":"Webhook Secret","type":"password","required":false}
]'::jsonb WHERE code = 'lemonsqueezy';

UPDATE public.provider_catalog SET setup_fields = '[
  {"key":"gateway_name","label":"Gateway Name","type":"text","required":true},
  {"key":"api_endpoint","label":"API Endpoint","placeholder":"https://api.example.com","type":"url","required":true},
  {"key":"api_key","label":"API Key","type":"password","required":true},
  {"key":"webhook_secret","label":"Webhook Secret","type":"password","required":false}
]'::jsonb WHERE code = 'custom_gateway';

UPDATE public.provider_catalog SET setup_fields = '[
  {"key":"api_key","label":"API Key","placeholder":"re_...","type":"password","required":true},
  {"key":"from_email","label":"From Email","placeholder":"hello@example.com","type":"email","required":true},
  {"key":"from_name","label":"From Name","type":"text","required":false}
]'::jsonb WHERE code = 'resend';

UPDATE public.provider_catalog SET setup_fields = '[
  {"key":"api_key","label":"API Key","type":"password","required":true},
  {"key":"from_email","label":"From Email","type":"email","required":true},
  {"key":"from_name","label":"From Name","type":"text","required":false}
]'::jsonb WHERE code = 'sendgrid';

UPDATE public.provider_catalog SET setup_fields = '[
  {"key":"host","label":"SMTP Host","type":"text","required":true},
  {"key":"port","label":"Port","type":"number","required":true},
  {"key":"username","label":"Username","type":"text","required":true},
  {"key":"password","label":"Password","type":"password","required":true},
  {"key":"from_email","label":"From Email","type":"email","required":true},
  {"key":"from_name","label":"From Name","type":"text","required":false},
  {"key":"secure","label":"Security","type":"select","options":["starttls","tls","none"],"required":false}
]'::jsonb WHERE code = 'smtp';

UPDATE public.provider_catalog SET setup_fields = '[
  {"key":"api_key","label":"API Key","type":"password","required":true},
  {"key":"from_domain","label":"From Domain","placeholder":"mg.example.com","type":"text","required":true},
  {"key":"region","label":"Region","type":"select","options":["us","eu"],"required":true}
]'::jsonb WHERE code = 'mailgun';

UPDATE public.provider_catalog SET setup_fields = '[
  {"key":"api_key","label":"Server API Token","type":"password","required":true},
  {"key":"from_domain","label":"From Domain","type":"text","required":true}
]'::jsonb WHERE code = 'postmark';

UPDATE public.provider_catalog SET setup_fields = '[
  {"key":"phone_number_id","label":"Phone Number ID","type":"text","required":true},
  {"key":"business_account_id","label":"WhatsApp Business Account ID","type":"text","required":true},
  {"key":"access_token","label":"Permanent Access Token","type":"password","required":true},
  {"key":"verify_token","label":"Webhook Verify Token","type":"password","required":true},
  {"key":"webhook_secret","label":"App Secret (for signature)","type":"password","required":false}
]'::jsonb WHERE code = 'meta_wa';
