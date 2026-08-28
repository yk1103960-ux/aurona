import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";



const AddressSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(6).max(20).regex(/^[+\d\s\-()]+$/),
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
 * - Reads the caller's cart via RLS (no client price input trusted).
 * - Recomputes item prices from product_variants using the caller's pricing role.
 * - Recomputes shipping from the server-side rate table.
 * - Distributors cannot check out (contact-sales only).
 * - Inserts order + items in a single controlled server call.
 */
export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PlaceOrderInput.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    // 1) Pricing role — if distributor, block checkout entirely.
    const { data: roleData } = await supabase.rpc("current_pricing_role");
    const role = (roleData as string | null) ?? "guest";
    if (role === "distributor") {
      throw new Error("Distributor accounts must contact sales to place orders.");
    }

    // 2) Load the caller's cart via RLS. Trust nothing from the client.
    const { data: cartRows, error: cartErr } = await supabase
      .from("cart_items")
      .select("id, product_id, quantity, products(id, sku, name, price)")
      .order("created_at", { ascending: false });
    if (cartErr) throw new Error("Unable to load cart. Please try again.");
    const items = (cartRows ?? []) as Array<{
      id: string;
      product_id: string;
      quantity: number;
      products: { id: string; sku: string | null; name: string; price: number } | null;
    }>;
    if (items.length === 0) throw new Error("Your cart is empty.");

    // 3) Validate quantities and collect SKUs for authoritative pricing.
    for (const it of items) {
      if (!it.products) throw new Error("A product in your cart is unavailable.");
      if (!Number.isInteger(it.quantity) || it.quantity <= 0 || it.quantity > 999) {
        throw new Error("Invalid quantity in cart.");
      }
    }
    const skus = items.map((i) => i.products!.sku).filter(Boolean) as string[];

    // 4) Ask the DB for the caller's visible (role-adjusted) prices.
    const priceMap = new Map<string, number>();
    if (skus.length > 0) {
      const { data: priced, error: priceErr } = await supabase.rpc("get_visible_prices", { _skus: skus });
      if (priceErr) throw new Error("Unable to price your cart. Please try again.");
      for (const row of (priced ?? []) as Array<{ sku: string; price: number | null }>) {
        if (row.price != null) priceMap.set(row.sku, Number(row.price));
      }
    }

    // 5) Recompute totals from the authoritative prices.
    let subtotal = 0;
    let mrpTotal = 0;
    const orderItems = items.map((it) => {
      const sku = it.products!.sku;
      const authoritative = sku ? priceMap.get(sku) : undefined;
      const price = authoritative ?? Number(it.products!.price);
      if (!Number.isFinite(price) || price <= 0) {
        throw new Error("A product in your cart is unavailable.");
      }
      subtotal += price * it.quantity;
      mrpTotal += price * it.quantity;
      return {
        product_id: it.product_id,
        product_name: it.products!.name,
        price,
        quantity: it.quantity,
      };
    });
    subtotal = Math.round(subtotal * 100) / 100;

    // 6) Shipping. Courier (Shiprocket) charges apply to retail customers only:
    // retailer and distributor orders ship through our local transport network
    // and are never charged a customer courier rate. Enforced here on the
    // server so the browser cannot influence it.
    const wholesale = role === "retailer" || role === "distributor";
    let shipping = 0;

    if (wholesale) {
      shipping = 0;
    } else {
      const { quoteShippingForCart } = await import("./shipping.server");
      const quote = await quoteShippingForCart({
        lines: items.map((it) => ({
          sku: it.products!.sku,
          name: it.products!.name,
          price: Number(it.products!.price),
          quantity: it.quantity,
        })),
        pincode: data.address.pincode,
        cod: data.payment_method === "cod",
        subtotal,
      });
      if (!quote.serviceable) {
        throw new Error(quote.message ?? "Delivery is unavailable for this pincode.");
      }
      const rate = quote.rates.find((r) => r.id === data.shipping_rate_id) ?? quote.rates[0];
      if (!rate) throw new Error("Selected shipping option is no longer available.");
      shipping = Math.round(Number(rate.price) * 100) / 100;
      shippingRateId = rate.id;
    }
    void shippingRateId;

    // 6b) Coupon — validated server-side; the browser never supplies a discount.
    let couponId: string | null = null;
    let couponDiscount = 0;
    if (data.coupon_code) {
      const { data: rows } = await supabase.rpc("validate_coupon", {
        _code: data.coupon_code,
        _subtotal: subtotal,
      });
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row?.coupon_id) {
        throw new Error(row?.reason ?? "This coupon is not valid for your order.");
      }
      couponId = row.coupon_id as string;
      couponDiscount = Math.min(subtotal, Math.max(0, Number(row.discount ?? 0)));
    }

    const total = Math.round((subtotal - couponDiscount + shipping) * 100) / 100;


    // 7) Insert order + items using the user-scoped client (RLS enforces ownership).
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        user_id: context.userId,
        subtotal,
        discount: Math.max(0, mrpTotal - subtotal) + couponDiscount,
        shipping,
        total,
        discount_code: data.coupon_code ?? null,
        payment_method: data.payment_method,
        payment_status: "pending",
        status: "pending",
        full_name: data.address.full_name,
        phone: data.address.phone,
        email: data.address.email || null,
        address: data.address.address,
        city: data.address.city,
        state: data.address.state,
        pincode: data.address.pincode,
      })
      .select("id, order_number")
      .single();

    if (orderErr || !order) throw new Error("Unable to place your order. Please try again.");

    const { error: itemsErr } = await supabase.from("order_items").insert(
      orderItems.map((it) => ({ ...it, order_id: order.id })),
    );
    if (itemsErr) {
      // best-effort rollback
      await supabase.from("orders").delete().eq("id", order.id);
      throw new Error("Unable to place your order. Please try again.");
    }

    // 7b) Record the coupon redemption (never blocks the order).
    if (couponId) {
      await supabase
        .rpc("redeem_coupon", { _coupon_id: couponId, _order_id: order.id, _amount: couponDiscount })
        .then(() => undefined, () => undefined);
    }


    // 8) Affiliate commission (no-op when the buyer isn't attributed).
    try {
      const { recordCommissionForOrder } = await import("./affiliate.server");
      await recordCommissionForOrder(order.id);
    } catch {
      // Commission accounting must never block a paid order.
    }

    // 9) Clear the cart.
    await supabase.from("cart_items").delete().eq("user_id", context.userId);


    return { orderId: order.id, orderNumber: order.order_number, total };
  });
