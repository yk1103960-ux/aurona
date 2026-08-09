UPDATE public.integrations
SET config_public = jsonb_build_object(
      'providerName', 'msg91',
      'senderId', 'AURONA',
      'templateId', '67978567d6fc0554473309a4',
      'dltTemplateId', '1007630933578375890'
    ),
    status = 'configured',
    enabled = true,
    updated_at = now()
WHERE provider = 'sms';