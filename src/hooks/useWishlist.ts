import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "./useAuth";
import type { Product } from "@/lib/queries";

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
      return (data ?? []) as unknown as { id: string; product_id: string; products: Product }[];
    },
  });

  const has = (productId: string) => !!wl.data?.find((w) => w.product_id === productId);

  const toggle = useMutation({
    mutationFn: async (productId: string) => {
      if (!user) throw new Error("Please sign in to save products");
      const existing = wl.data?.find((w) => w.product_id === productId);
      if (existing) {
        const { error } = await supabase.from("wishlist_items").delete().eq("id", existing.id);
        if (error) throw error;
        return "removed" as const;
      }
      const { error } = await supabase
        .from("wishlist_items")
        .insert({ user_id: user.id, product_id: productId });
      if (error) throw error;
      return "added" as const;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["wishlist"] });
      toast.success(r === "added" ? "Saved to wishlist" : "Removed from wishlist");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { items: wl.data ?? [], has, toggle, count: wl.data?.length ?? 0 };
}
