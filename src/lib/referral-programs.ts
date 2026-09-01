import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ReferralProgram = {
  id: string;
  name: string;
  description: string;
  eligibility: string | null;
  commission_kind: "percentage" | "fixed";
  commission_value: number;
  max_commission: number | null;
  min_order_value: number;
  terms: string | null;
  closes_at: string | null;
  is_active: boolean;
  sort_order: number;
};

/** Admin-managed referral programs shown on the careers page. */
export const referralProgramsQuery = queryOptions({
  queryKey: ["referral-programs"],
  staleTime: 5 * 60 * 1000,
  queryFn: async (): Promise<ReferralProgram[]> => {
    const { data, error } = await supabase
      .from("referral_programs")
      .select("id, name, description, eligibility, commission_kind, commission_value, max_commission, min_order_value, terms, closes_at, is_active, sort_order")
      .eq("is_published", true)
      .order("sort_order", { ascending: true });
    if (error) return [];
    return ((data ?? []) as ReferralProgram[]).filter(
      (p) => p.is_active && (!p.closes_at || new Date(p.closes_at).getTime() > Date.now()),
    );
  },
});

export function commissionLabel(p: ReferralProgram): string {
  const base = p.commission_kind === "fixed" ? `₹${Number(p.commission_value)} per order` : `${Number(p.commission_value)}% commission`;
  return p.max_commission ? `${base} (up to ₹${Number(p.max_commission)})` : base;
}
