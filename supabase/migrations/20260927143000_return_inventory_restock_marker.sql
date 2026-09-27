BEGIN;

-- Final stabilization: a completed/received return must mark inventory as
-- restocked exactly once so the buyer-specific PC restoration trigger runs.
CREATE OR REPLACE FUNCTION public.admin_update_return_request(
  _request_id uuid,
  _status public.return_status,
  _refund_amount numeric,
  _refund_reference text,
  _note text,
  _actor_user_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request public.return_requests%ROWTYPE;
  should_restock boolean;
BEGIN
  SELECT * INTO request
  FROM public.return_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'return request not found';
  END IF;

  IF COALESCE(_refund_amount, 0) < 0 THEN
    RAISE EXCEPTION 'refund amount cannot be negative';
  END IF;

  IF request.status IN ('completed','cancelled','rejected','refunded')
     AND _status <> request.status THEN
    RAISE EXCEPTION 'this request is already final';
  END IF;

  should_restock :=
    request.kind = 'return'
    AND request.restocked_at IS NULL
    AND _status IN ('received','completed');

  UPDATE public.return_requests
  SET status = _status,
      refund_amount = COALESCE(_refund_amount, 0),
      refund_reference = NULLIF(btrim(_refund_reference), ''),
      admin_note = NULLIF(btrim(_note), ''),
      reviewed_by = _actor_user_id,
      reviewed_at = now(),
      restocked_at = CASE
        WHEN should_restock THEN now()
        ELSE restocked_at
      END,
      updated_at = now()
  WHERE id = _request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_return_request(
  uuid, public.return_status, numeric, text, text, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_return_request(
  uuid, public.return_status, numeric, text, text, uuid
) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
