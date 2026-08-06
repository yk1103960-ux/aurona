import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "./useAuth";
import { resolveProductId } from "@/lib/resolve-product";
import type { Product } from "@/lib/queries";

export type WishlistRow = { id: string; product_id: string; products: Product };

export function useWishlist() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const wl = useQuery({
    queryKey: ["wishlist", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wishlist_items")
        .select("id, product_id, products(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as WishlistRow[];
    },
  });

  const items = wl.data ?? [];

  /** Matches by real product id OR SKU — listing cards carry family ids. */
  const has = (idOrSku?: string | null, sku?: string | null) =>
    !!items.find(
      (w) =>
        (idOrSku && (w.product_id === idOrSku || w.products?.sku === idOrSku)) ||
        (sku && w.products?.sku === sku),
    );

  const toggle = useMutation({
    mutationFn: async (input: string | { productId: string; sku?: string | null }) => {
      if (!user) throw new Error("Please sign in to save products");
      const productId = typeof input === "string" ? input : input.productId;
      const sku = typeof input === "string" ? null : input.sku ?? null;
      const realId = await resolveProductId(productId, sku);
      const existing = items.find((w) => w.product_id === realId);
      if (existing) {
        const { error } = await supabase.from("wishlist_items").delete().eq("id", existing.id);
        if (error) throw error;
        return "removed" as const;
      }
      const { error } = await supabase
        .from("wishlist_items")
        .insert({ user_id: user.id, product_id: realId });
      if (error) throw error;
      return "added" as const;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["wishlist"] });
      toast.success(r === "added" ? "Saved to wishlist" : "Removed from wishlist");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { items, has, toggle, count: items.length, loading: wl.isLoading };
}
