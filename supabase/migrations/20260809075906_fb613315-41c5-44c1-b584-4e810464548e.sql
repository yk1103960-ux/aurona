UPDATE public.integrations
SET config_public = COALESCE(config_public, '{}'::jsonb)
      - 'templateId'
      - 'dltTemplateId'
      || jsonb_build_object(
        'providerName', 'msg91',
        'senderId', 'AURONA',
        'templateId', '6a7826ee25e4a56c84021ea2',
        'dltTemplateId', '1077436770064246433',
        'otpLength', '6',
        'otpExpiryMinutes', '10'
      ),
    status = 'configured',
    enabled = true,
    updated_at = now()
WHERE provider = 'sms';