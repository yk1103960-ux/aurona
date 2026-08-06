import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "./useAuth";
import { resolveProductId } from "@/lib/resolve-product";
import type { Product } from "@/lib/queries";

export type CartRow = {
  id: string;
  product_id: string;
  quantity: number;
  products: Product;
};

export function useCart() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const cart = useQuery({
    queryKey: ["cart", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cart_items")
        .select("id, product_id, quantity, products(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CartRow[];
    },
  });

  const items = cart.data ?? [];

  /** Matches by real product id OR by SKU (listing cards carry family ids). */
  const lineFor = (idOrSku?: string | null, sku?: string | null) =>
    items.find(
      (i) =>
        (idOrSku && (i.product_id === idOrSku || i.products?.sku === idOrSku)) ||
        (sku && i.products?.sku === sku),
    );

  const add = useMutation({
    mutationFn: async ({
      productId,
      sku,
      quantity = 1,
    }: { productId: string; sku?: string | null; quantity?: number }) => {
      if (!user) throw new Error("Please sign in to add to cart");
      const realId = await resolveProductId(productId, sku);
      const existing = items.find((c) => c.product_id === realId);
      if (existing) {
        const { error } = await supabase
          .from("cart_items")
          .update({ quantity: existing.quantity + quantity })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cart_items")
          .insert({ user_id: user.id, product_id: realId, quantity });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateQty = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      if (quantity <= 0) {
        const { error } = await supabase.from("cart_items").delete().eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cart_items").update({ quantity }).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cart_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
      toast.success("Removed from cart");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clear = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from("cart_items").delete().eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + Number(i.products.price) * i.quantity, 0);
  const mrpTotal = items.reduce((s, i) => s + Number(i.products.mrp) * i.quantity, 0);

  return { items, count, subtotal, mrpTotal, loading: cart.isLoading, lineFor, add, updateQty, remove, clear };
}
