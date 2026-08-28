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
  const canPurchase = r.role !== "distributor";
  const showPrices = !(isPartnerPending);
  return { ...r, isApproved, isPartner, isPartnerPending, canPurchase, showPrices, loading: q.isLoading };
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
