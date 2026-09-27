BEGIN;

-- Bulk Product Master column 62 is "Commission Set on". In Product Manager,
-- "All Variants" is a grouping scope, not a referral-program name. Keep the
-- legacy importer for product/variant persistence, but prevent it from
-- misreading column 62 and apply commissions here with Product Manager
-- semantics in the same transaction.
CREATE OR REPLACE FUNCTION public.admin_import_dynamic_products_v3(
  _rows jsonb,
  _actor_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  clean_rows jsonb;
  result jsonb;
  variant_id_value uuid;
  program_row record;
  specific_program_id uuid;
  commission_set_on text;
  commission_norm text;
  commission_kind_value text;
  commission_value_value numeric;
  max_commission_value numeric;
  axis_matches boolean;
  program_count integer;
BEGIN
  SELECT COALESCE(
    jsonb_agg(
      value
      - 'commission_program'
      - 'commission_set_on'
      - 'commission_type'
      - 'commission_value'
      - 'max_commission'
    ),
    '[]'::jsonb
  )
  INTO clean_rows
  FROM jsonb_array_elements(COALESCE(_rows, '[]'::jsonb));

  result := public.admin_import_dynamic_products_v2(clean_rows, _actor_user_id);

  SELECT count(*) INTO program_count FROM public.referral_programs;

  FOR item IN
    SELECT value FROM jsonb_array_elements(COALESCE(_rows, '[]'::jsonb))
  LOOP
    commission_set_on := COALESCE(
      NULLIF(btrim(item->>'commission_set_on'), ''),
      NULLIF(btrim(item->>'commission_program'), '')
    );

    IF commission_set_on IS NULL THEN
      CONTINUE;
    END IF;

    commission_norm := lower(
      regexp_replace(btrim(commission_set_on), '[[:space:]]+', ' ', 'g')
    );
    commission_kind_value := lower(NULLIF(btrim(item->>'commission_type'), ''));
    commission_value_value := NULLIF(btrim(item->>'commission_value'), '')::numeric;
    max_commission_value := NULLIF(btrim(item->>'max_commission'), '')::numeric;

    IF commission_kind_value NOT IN ('percentage', 'fixed') THEN
      RAISE EXCEPTION
        'Commission Type must be Percentage or Fixed at Excel row %',
        item->>'excel_row';
    END IF;

    IF commission_value_value IS NULL OR commission_value_value < 0 THEN
      RAISE EXCEPTION
        'Commission Value must be 0 or greater at Excel row %',
        item->>'excel_row';
    END IF;

    IF commission_kind_value = 'percentage' AND commission_value_value > 100 THEN
      RAISE EXCEPTION
        'Percentage commission cannot exceed 100 at Excel row %',
        item->>'excel_row';
    END IF;

    IF max_commission_value IS NOT NULL AND max_commission_value < 0 THEN
      RAISE EXCEPTION
        'Max commission cannot be negative at Excel row %',
        item->>'excel_row';
    END IF;

    SELECT v.id INTO variant_id_value
    FROM public.product_variants v
    WHERE upper(v.sku) = upper(btrim(item->>'variant_sku'))
    LIMIT 1;

    IF variant_id_value IS NULL THEN
      RAISE EXCEPTION
        'Imported variant % could not be found for commission setup at Excel row %',
        item->>'variant_sku', item->>'excel_row';
    END IF;

    specific_program_id := NULL;
    SELECT p.id
    INTO specific_program_id
    FROM public.referral_programs p
    WHERE lower(regexp_replace(btrim(p.name), '[[:space:]]+', ' ', 'g')) = commission_norm
    LIMIT 1;

    SELECT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(item->'variation_axes', '[]'::jsonb)) axis
      WHERE lower(
        regexp_replace(
          btrim(COALESCE(axis->>'name', axis->>'label', axis->>'axis_key', '')),
          '[[:space:]]+',
          ' ',
          'g'
        )
      ) = commission_norm
    )
    INTO axis_matches;

    IF commission_norm IN ('all variants', '__all') OR axis_matches THEN
      IF program_count = 0 THEN
        RAISE EXCEPTION
          'No partner programs exist for Commission Set on "%" at Excel row %',
          commission_set_on, item->>'excel_row';
      END IF;

      FOR program_row IN
        SELECT id FROM public.referral_programs
      LOOP
        INSERT INTO public.variant_program_commissions(
          variant_id,
          program_id,
          commission_kind,
          commission_value,
          max_commission,
          is_active
        )
        VALUES(
          variant_id_value,
          program_row.id,
          commission_kind_value,
          commission_value_value,
          max_commission_value,
          true
        )
        ON CONFLICT(variant_id, program_id)
        DO UPDATE SET
          commission_kind = EXCLUDED.commission_kind,
          commission_value = EXCLUDED.commission_value,
          max_commission = EXCLUDED.max_commission,
          is_active = true;
      END LOOP;
    ELSIF specific_program_id IS NOT NULL THEN
      INSERT INTO public.variant_program_commissions(
        variant_id,
        program_id,
        commission_kind,
        commission_value,
        max_commission,
        is_active
      )
      VALUES(
        variant_id_value,
        specific_program_id,
        commission_kind_value,
        commission_value_value,
        max_commission_value,
        true
      )
      ON CONFLICT(variant_id, program_id)
      DO UPDATE SET
        commission_kind = EXCLUDED.commission_kind,
        commission_value = EXCLUDED.commission_value,
        max_commission = EXCLUDED.max_commission,
        is_active = true;
    ELSE
      RAISE EXCEPTION
        'Unknown Commission Set on "%" at Excel row %. Expected All Variants, a variation axis, or an existing partner program.',
        commission_set_on, item->>'excel_row';
    END IF;
  END LOOP;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_import_dynamic_products_v3(jsonb, uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_import_dynamic_products_v3(jsonb, uuid)
TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
