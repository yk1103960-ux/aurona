import { useEffect } from "react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PricingRole = "guest" | "customer" | "retailer" | "distributor" | "admin";
export type RoleStatus = { role: PricingRole; status: "anon" | "pending" | "under_review" | "approved" | "rejected"; intended_role: string };

export const myRoleStatusQuery = queryOptions({
  queryKey: ["my-role-status"],
  staleTime: 60 * 1000,
  queryFn: async (): Promise<RoleStatus> => {
    const { data, error } = await supabase.rpc("my_role_status");
    if (error) throw error;
    const row = (data as RoleStatus[] | null)?.[0];
    return row ?? { role: "guest", status: "anon", intended_role: "guest" };
  },
});

export function useMyRole() {
  const q = useQuery(myRoleStatusQuery);
  const r = q.data ?? { role: "guest" as PricingRole, status: "anon" as const, intended_role: "guest" };
  const isApproved = r.status === "approved";
  const isPartner = r.role === "retailer" || r.role === "distributor";
  const isPartnerPending = isPartner && !isApproved;
  // Approved partners (retailer AND distributor) can buy at their own price.
  // Only unapproved partner accounts are blocked from purchasing.
  const canPurchase = !isPartnerPending;
  const showPrices = !isPartnerPending;
  const isVerifiedPartner = isPartner && isApproved;
  return { ...r, isApproved, isPartner, isPartnerPending, isVerifiedPartner, canPurchase, showPrices, loading: q.isLoading };
}

/**
 * Keeps role/pricing state in sync in real time: when an admin approves a
 * partner application or grants a role, the visible prices refresh instantly
 * without a page reload.
 */
export function useRolePricingRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    const refresh = () => {
      qc.invalidateQueries({ queryKey: ["my-role-status"] });
      qc.invalidateQueries({ queryKey: ["visible-prices"] });
    };
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || cancelled) return;
      channel = supabase
        .channel(`role-sync-${uid}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "partner_applications", filter: `user_id=eq.${uid}` }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${uid}` }, refresh)
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [qc]);
}

export type VisiblePrice = { sku: string; mrp: number | null; price: number | null; role: PricingRole };

export const visiblePricesQuery = (skus: string[]) =>
  queryOptions({
    queryKey: ["visible-prices", [...skus].sort().join(",")],
    enabled: skus.length > 0,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<Record<string, VisiblePrice>> => {
      if (skus.length === 0) return {};
      const { data, error } = await supabase.rpc("get_visible_prices", { _skus: skus });
      if (error) throw error;
      const map: Record<string, VisiblePrice> = {};
      for (const r of (data ?? []) as VisiblePrice[]) map[r.sku] = r;
      return map;
    },
  });

export function useVisiblePrices(skus: string[]) {
  return useQuery(visiblePricesQuery(skus));
}
