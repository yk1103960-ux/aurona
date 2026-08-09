ALTER TABLE public.affiliates REPLICA IDENTITY FULL;
ALTER TABLE public.affiliate_commissions REPLICA IDENTITY FULL;
ALTER TABLE public.affiliate_withdrawals REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.affiliates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.affiliate_commissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.affiliate_withdrawals;