CREATE TABLE IF NOT EXISTS public.tmp_stock_restore (
  sku text PRIMARY KEY,
  stock integer NOT NULL
);
GRANT ALL ON public.tmp_stock_restore TO service_role;
ALTER TABLE public.tmp_stock_restore ENABLE ROW LEVEL SECURITY;