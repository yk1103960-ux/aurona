import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const QuoteInput = z.object({
  pincode: z.string().trim().max(12),
  cod: z.boolean().default(false),
});

/**
 * Live shipping quote for the signed-in caller's cart.
 * Weight/dimensions come from product_variants, rates from Shiprocket
 * serviceability for the destination pincode. Prices are never taken from
 * the client.
 */
export const quoteShipping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => QuoteInput.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { data: cartRows, error } = await supabase
      .from("cart_items")
      .select("quantity, products(sku, name, price)");
    if (error) throw new Error("Unable to load your cart.");

    const rows = (cartRows ?? []) as unknown as Array<{
      quantity: number;
      products: { sku: string | null; name: string; price: number } | null;
    }>;
    const lines = rows
      .filter((r) => r.products)
      .map((r) => ({
        sku: r.products!.sku,
        name: r.products!.name,
        price: Number(r.products!.price),
        quantity: r.quantity,
      }));

    if (lines.length === 0) {
      return { serviceable: false, message: "Your cart is empty.", source: "fallback" as const, weightKg: 0, rates: [] };
    }

    // Role-adjusted subtotal for free-shipping thresholds / declared value.
    const skus = lines.map((l) => l.sku).filter(Boolean) as string[];
    const priceMap = new Map<string, number>();
    if (skus.length > 0) {
      const { data: priced } = await supabase.rpc("get_visible_prices", { _skus: skus });
      for (const row of (priced ?? []) as Array<{ sku: string; price: number | null }>) {
        if (row.price != null) priceMap.set(row.sku, Number(row.price));
      }
    }
    const subtotal = lines.reduce(
      (s, l) => s + ((l.sku ? priceMap.get(l.sku) : undefined) ?? l.price) * l.quantity,
      0,
    );

    const { quoteShippingForCart } = await import("./shipping.server");
    return quoteShippingForCart({ lines, pincode: data.pincode, cod: data.cod, subtotal });
  });
