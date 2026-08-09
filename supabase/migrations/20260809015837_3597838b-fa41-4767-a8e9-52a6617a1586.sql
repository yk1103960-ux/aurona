UPDATE public.integrations
SET config_public = coalesce(config_public, '{}'::jsonb) || jsonb_build_object('checkoutRing','test'),
    status = 'error',
    last_tested_at = now(),
    last_test_message = 'Live API accepted the signed request (HTTP 200, PAYMENT_INITIATED) but returned a UAT checkout page (mercury-t2.phonepe.com). Merchant is not activated on the production checkout ring, so hosted payment fails at instrument selection.'
WHERE provider = 'phonepe';

INSERT INTO public.payment_events (provider, merchant_txn_id, stage, environment, endpoint, http_method, http_status, ok, checkout_host, amount, provider_code, provider_message, payment_state)
VALUES ('phonepe','DIAG-BASELINE','config_test','live','https://api.phonepe.com/apis/hermes/pg/v1/pay','POST',200,false,'mercury-t2.phonepe.com',1,'ENVIRONMENT_MISMATCH','Signed request accepted but PhonePe returned a UAT (test-ring) hosted checkout page for a live configuration.','PENDING')
ON CONFLICT DO NOTHING;