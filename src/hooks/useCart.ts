import { useCallback, useEffect, useState } from "react";
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

/* ------------------------------------------------------------------ *
 * Guest cart — logged-out shoppers can add to cart and view the cart.
 * Only product ids and quantities are kept locally; every price and
 * product detail is still read live from the database.
 * ------------------------------------------------------------------ */
const GUEST_KEY = "aurona.guest_cart";
const GUEST_EVENT = "aurona:guest-cart";

type GuestLine = { product_id: string; quantity: number };

function readGuest(): GuestLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(GUEST_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((l) => l && typeof l.product_id === "string" && Number(l.quantity) > 0)
      .map((l) => ({ product_id: l.product_id as string, quantity: Number(l.quantity) }));
  } catch {
    return [];
  }
}

function writeGuest(next: GuestLine[]) {
  localStorage.setItem(GUEST_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(GUEST_EVENT));
}

export function useCart() {
  const { user, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const [guestLines, setGuestLines] = useState<GuestLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => setGuestLines(readGuest());
    sync();
    setHydrated(true);
    window.addEventListener(GUEST_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(GUEST_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const isGuest = !user;

  const cart = useQuery({
    queryKey: ["cart", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cart_items")
        .select("id, product_id, quantity, products(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as CartRow[];
      const withImages = await attachProductImages(rows.map((r) => r.products));
      const byId = new Map(withImages.map((p) => [p.id, p]));
      return rows.map((r) => ({ ...r, products: (byId.get(r.products.id) ?? r.products) as Product }));
    },
  });

  const guestIds = guestLines.map((l) => l.product_id).sort().join(",");
  const guestCart = useQuery({
    queryKey: ["cart", "guest", guestIds],
    enabled: isGuest && hydrated && guestLines.length > 0,
    queryFn: async () => {
      const ids = guestLines.map((l) => l.product_id);
      const { data, error } = await supabase.from("products").select("*").in("id", ids);
      if (error) throw error;
      const withImages = await attachProductImages((data ?? []) as unknown as Product[]);
      const byId = new Map(withImages.map((p) => [p.id, p as unknown as Product]));
      return guestLines
        .filter((l) => byId.has(l.product_id))
        .map((l) => ({
          id: l.product_id,
          product_id: l.product_id,
          quantity: l.quantity,
          products: byId.get(l.product_id)!,
        })) as CartRow[];
    },
  });


  const items = isGuest ? (guestLines.length ? (guestCart.data ?? []) : []) : (cart.data ?? []);

  /** Merge the guest cart into the account cart right after sign-in. */
  useEffect(() => {
    if (!user || !hydrated) return;
    const lines = readGuest();
    if (lines.length === 0) return;
    (async () => {
      const { data: existing } = await supabase.from("cart_items").select("id, product_id, quantity");
      for (const line of lines) {
        const match = (existing ?? []).find((e) => e.product_id === line.product_id);
        if (match) {
          await supabase
            .from("cart_items")
            .update({ quantity: match.quantity + line.quantity })
            .eq("id", match.id);
        } else {
          await supabase
            .from("cart_items")
            .insert({ user_id: user.id, product_id: line.product_id, quantity: line.quantity });
        }
      }
      writeGuest([]);
      qc.invalidateQueries({ queryKey: ["cart"] });
    })();
  }, [user?.id, hydrated]);

  /** Matches by real product id OR by SKU (listing cards carry family ids). */
  const lineFor = (idOrSku?: string | null, sku?: string | null) =>
    items.find(
      (i) =>
        (idOrSku && (i.product_id === idOrSku || i.products?.sku === idOrSku)) ||
        (sku && i.products?.sku === sku),
    );

  const addGuest = useCallback((realId: string, quantity: number) => {
    const current = readGuest();
    const found = current.find((l) => l.product_id === realId);
    writeGuest(
      found
        ? current.map((l) => (l.product_id === realId ? { ...l, quantity: l.quantity + quantity } : l))
        : [...current, { product_id: realId, quantity }],
    );
  }, []);

  const add = useMutation({
    mutationFn: async ({
      productId,
      sku,
      quantity = 1,
    }: { productId: string; sku?: string | null; quantity?: number }) => {
      const realId = await resolveProductId(productId, sku);
      if (!user) {
        addGuest(realId, quantity);
        return;
      }
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
      if (!user) {
        const current = readGuest();
        writeGuest(
          quantity <= 0
            ? current.filter((l) => l.product_id !== id)
            : current.map((l) => (l.product_id === id ? { ...l, quantity } : l)),
        );
        return;
      }
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
      if (!user) {
        writeGuest(readGuest().filter((l) => l.product_id !== id));
        return;
      }
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
      if (!user) {
        writeGuest([]);
        return;
      }
      const { error } = await supabase.from("cart_items").delete().eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + Number(i.products.price) * i.quantity, 0);
  const mrpTotal = items.reduce((s, i) => s + Number(i.products.mrp) * i.quantity, 0);
  const loading = isGuest ? authLoading || (guestLines.length > 0 && guestCart.isLoading) : cart.isLoading;

  return { items, count, subtotal, mrpTotal, loading, isGuest, lineFor, add, updateQty, remove, clear };
}
