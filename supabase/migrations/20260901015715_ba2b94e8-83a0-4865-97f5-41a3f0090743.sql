UPDATE public.product_families f
SET category_id = (SELECT id FROM public.categories WHERE slug='interior-lights')
WHERE f.category_id = (SELECT id FROM public.categories WHERE slug='decorative-lights');

UPDATE public.products p
SET category_id = (SELECT id FROM public.categories WHERE slug='interior-lights')
WHERE p.category_id = (SELECT id FROM public.categories WHERE slug='decorative-lights');

DROP POLICY IF EXISTS "return events insert" ON public.return_events;
CREATE POLICY "return events insert" ON public.return_events
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR (
    status = 'requested'::return_status
    AND EXISTS (
      SELECT 1 FROM public.return_requests r
      WHERE r.id = return_events.request_id AND r.user_id = auth.uid()
    )
  )
);