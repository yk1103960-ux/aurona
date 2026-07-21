
DELETE FROM product_variants v
USING product_families f, categories c
WHERE v.family_id = f.id
  AND f.category_id = c.id
  AND c.slug = 'led-bulbs'
  AND v.attributes->>'pack_size' IN ('Pack of 1','Pack of 4');

UPDATE product_variant_axes a
SET values = sub.vals
FROM (
  SELECT v.family_id,
    to_jsonb(ARRAY(SELECT DISTINCT v2.attributes->>'pack_size'
                   FROM product_variants v2
                   WHERE v2.family_id = v.family_id AND v2.attributes ? 'pack_size'
                   ORDER BY 1)) AS vals
  FROM product_variants v
  JOIN product_families f ON f.id = v.family_id
  JOIN categories c ON c.id = f.category_id
  WHERE c.slug = 'led-bulbs'
  GROUP BY v.family_id
) sub
WHERE a.family_id = sub.family_id AND a.axis_key = 'pack_size';

UPDATE product_families f SET
  min_price = agg.min_price, max_price = agg.max_price,
  min_mrp = agg.min_mrp, max_mrp = agg.max_mrp,
  total_stock = agg.total_stock
FROM (
  SELECT family_id,
    MIN(price) AS min_price, MAX(price) AS max_price,
    MIN(mrp) AS min_mrp, MAX(mrp) AS max_mrp,
    COALESCE(SUM(stock),0) AS total_stock
  FROM product_variants GROUP BY family_id
) agg
WHERE f.id = agg.family_id
  AND f.category_id = (SELECT id FROM categories WHERE slug='led-bulbs');
