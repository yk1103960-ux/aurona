import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { quoteShipping } from "@/lib/shipping.functions";

const AddressSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  phone: z
    .string()
    .trim()
    .min(6)
    .max(20)
    .regex(/^\+?\d[\d\s\-()]+$/),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  address: z.string().trim().min(4).max(500),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().min(1).max(120),
  pincode: z.string().trim().min(4).max(12).regex(/^\d+$/),
});

const PlaceOrderInput = z.object({
  address: AddressSchema,
  payment_method: z.enum(["cod", "upi", "card"]),
  shipping_rate_id: z.string().trim().min(1).max(60),
  coupon_code: z.string().trim().min(2).max(64).optional(),
});

/**
 * Server-authoritative order placement.
 *
 * - Reads the signed-in user's cart from Supabase.
 * - Re-checks stock and published products.
 * - Recomputes role-aware prices with get_visible_prices().
 * - Re-quotes shipping on the server and verifies shipping_rate_id.
 * - Validates coupons directly from coupons/coupon_redemptions, avoiding the
 *   broken validate_coupon() RPC that currently throws "coupon_id is ambiguous".
 * - Writes orders + order_items, redeems the coupon, then clears the cart.
 */
export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PlaceOrderInput.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Please sign in again before placing your order.");
    }

    // 1) Pricing/account role.
    const { data: roleData, error: roleError } = await supabase.rpc("current_pricing_role");

    if (roleError) {
      throw new Error(roleError.message || "Could not verify your account type.");
    }

    const role = (roleData as string | null) ?? "customer";

    const buyerType = role === "retailer" || role === "distributor" ? role : "customer";

    // 2) Load the caller's cart. Never trust prices/totals sent by the browser.
    const { data: cartRows, error: cartError } = await supabase
      .from("cart_items")
      .select("id, product_id, quantity")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (cartError) {
      throw new Error(cartError.message || "Could not load your cart.");
    }

    const cart = cartRows ?? [];

    if (cart.length === 0) {
      throw new Error("Your cart is empty.");
    }

    // 3) Load authoritative product records.
    const productIds = [...new Set(cart.map((row) => row.product_id))];

    const { data: products, error: productError } = await supabase
      .from("products")
      .select("id, sku, name, price, stock, is_published")
      .in("id", productIds);

    if (productError) {
      throw new Error(productError.message || "Could not load products.");
    }

    const productById = new Map((products ?? []).map((product) => [product.id, product]));

    const items = cart.map((row) => {
      const product = productById.get(row.product_id);

      if (!product || !product.is_published) {
        throw new Error("A product in your cart is no longer available.");
      }

      const quantity = Number(row.quantity);

      if (!Number.isFinite(quantity) || quantity < 1) {
        throw new Error(`Invalid quantity for ${product.name}.`);
      }

      return {
        cartId: row.id,
        productId: product.id,
        sku: product.sku,
        name: product.name,
        quantity,
        fallbackPrice: Number(product.price ?? 0),
      };
    });

    // 4) Recompute the shopper's actual visible price for every SKU.
    const skus = [...new Set(items.map((item) => item.sku).filter(Boolean))];

    const { data: visiblePrices, error: priceError } = await supabase.rpc("get_visible_prices", {
      _skus: skus,
    });

    if (priceError) {
      throw new Error(priceError.message || "Could not calculate current product prices.");
    }

    const priceBySku = new Map(
      (visiblePrices ?? []).map((row) => [row.sku, Number(row.price ?? 0)]),
    );

    const pricedItems = items.map((item) => {
      const price = priceBySku.get(item.sku);

      if (price === undefined || !Number.isFinite(price) || price < 0) {
        throw new Error(`Could not calculate the current price for ${item.name}.`);
      }

      return {
        ...item,
        price,
      };
    });

    const subtotal = Number(
      pricedItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2),
    );

    if (!(subtotal > 0)) {
      throw new Error("Order subtotal is invalid.");
    }

    // 5) Re-quote delivery on the server and verify the chosen rate.
    const shippingQuote = await quoteShipping({
      data: {
        pincode: data.address.pincode,
        cod: data.payment_method === "cod",
      },
    });

    if (!shippingQuote?.serviceable || !Array.isArray(shippingQuote.rates)) {
      throw new Error(
        shippingQuote?.message || "Sorry, delivery is not available to this pincode.",
      );
    }

    const selectedRate = shippingQuote.rates.find(
      (rate) => String(rate.id) === data.shipping_rate_id,
    );

    if (!selectedRate) {
      throw new Error(
        "The selected delivery option is no longer available. Please choose delivery again.",
      );
    }

    const shipping = Math.max(0, Number(selectedRate.price ?? 0));

    if (!Number.isFinite(shipping)) {
      throw new Error("Could not calculate delivery charges.");
    }

    // 6) Validate coupon directly from tables.
    //    IMPORTANT: do NOT call validate_coupon() here while that SQL RPC is broken.
    let couponId: string | null = null;
    let couponCode: string | null = null;
    let discount = 0;

    if (data.coupon_code) {
      const code = data.coupon_code.trim().toUpperCase();

      const { data: coupon, error: couponError } = await supabase
        .from("coupons")
        .select(
          "id, code, type, value, min_order_value, max_discount, starts_at, expires_at, usage_limit, per_user_limit, eligible_roles, times_used, active",
        )
        .ilike("code", code)
        .eq("active", true)
        .maybeSingle();

      if (couponError) {
        throw new Error(couponError.message || "Could not validate coupon.");
      }

      if (!coupon) {
        throw new Error("Invalid coupon code.");
      }

      const now = Date.now();

      if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) {
        throw new Error("Coupon not yet active.");
      }

      if (coupon.expires_at && new Date(coupon.expires_at).getTime() < now) {
        throw new Error("Coupon expired.");
      }

      if (
        coupon.usage_limit !== null &&
        Number(coupon.times_used ?? 0) >= Number(coupon.usage_limit)
      ) {
        throw new Error("Coupon usage limit reached.");
      }

      if (subtotal < Number(coupon.min_order_value ?? 0)) {
        throw new Error("Minimum order not met for this coupon.");
      }

      const eligibleRoles = Array.isArray(coupon.eligible_roles) ? coupon.eligible_roles : [];

      if (!eligibleRoles.includes(role)) {
        throw new Error("This coupon is not eligible for your account type.");
      }

      const { count: usedCount, error: usageError } = await supabase
        .from("coupon_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("coupon_id", coupon.id)
        .eq("user_id", user.id)
        .is("reversed_at", null);

      if (usageError) {
        throw new Error(usageError.message || "Could not verify coupon usage.");
      }

      if (Number(usedCount ?? 0) >= Number(coupon.per_user_limit ?? 1)) {
        throw new Error("Coupon already used.");
      }

      if (coupon.type === "flat") {
        discount = Math.min(Number(coupon.value ?? 0), subtotal);
      } else {
        discount = (subtotal * Number(coupon.value ?? 0)) / 100;

        if (coupon.max_discount !== null) {
          discount = Math.min(discount, Number(coupon.max_discount));
        }
      }

      discount = Math.max(0, Number(discount.toFixed(2)));
      couponId = coupon.id;
      couponCode = coupon.code;
    }

    const total = Math.max(0, Number((subtotal - discount + shipping).toFixed(2)));

    // 7) Commit the order, snapshots, coupon usage, stock movements and cart
    // cleanup in one database transaction. This RPC is service-role only and
    // cannot be invoked directly by a shopper.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: orderId, error: orderError } = await (supabaseAdmin as any).rpc(
      "place_order_atomic_v2",
      {
        _user_id: user.id,
        _address: { ...data.address, email: data.address.email || user.email || "" },
        _payment_method: data.payment_method,
        _shipping: shipping,
        _items: pricedItems,
        _buyer_type: buyerType,
        _coupon_id: couponId,
        _coupon_code: couponCode,
        _discount: discount,
      },
    );

    if (orderError || !orderId) {
      throw new Error(orderError?.message || "Could not safely create your order.");
    }

    return {
      orderId: String(orderId),
      subtotal,
      shipping,
      discount,
      total,
    };
  });
