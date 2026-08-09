UPDATE public.integrations
SET config_public = jsonb_build_object(
      'providerName', 'msg91',
      'senderId', 'AURONA',
      'templateId', '1077436770064246433'
    ),
    status = 'configured',
    enabled = true,
    updated_at = now()
WHERE provider = 'sms';