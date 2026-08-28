UPDATE public.products
SET description = NULLIF(btrim(regexp_replace(description, '(?i)(\\n|\n)?\s*(retailer|distributor)\s*price\s*:\s*₹?\s*[0-9.,]+', '', 'g')), '')
WHERE description ~* '(retailer|distributor)\s*price';