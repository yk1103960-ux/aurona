import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getRazorpayCreds() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { decryptJSON } = await import("./crypto.server");
  const { data, error } = await supabaseAdmin
    .from("payment_gateways")
    .select("enabled, mode, config_secret_ciphertext")
    .eq("provider", "razorpay")
    .maybeSingle();
  if (error || !data?.enabled || !data.config_secret_ciphertext) {
    throw new Error("Razorpay is not configured");
  }
  const secrets = decryptJSON<{ keyId: string; keySecret: string; webhookSecret: string | null }>(
    data.config_secret_ciphertext,
  );
  return { ...secrets, mode: data.mode as "test" | "live" };
}

export const createRazorpayOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ orderId: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, total, user_id, email, phone, full_name, payment_status")
      .eq("id", data.orderId).single();
    if (error || !order) throw new Error("Order not found");
    if (order.user_id !== context.userId) throw new Error("Forbidden");
    if (order.payment_status === "paid") return { alreadyPaid: true };

    const creds = await getRazorpayCreds();
    const auth = Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString("base64");
    const r = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        amount: Math.round(Number(order.total) * 100),
        currency: "INR",
        receipt: order.order_number,
        notes: { orderId: order.id, userId: order.user_id },
      }),
    });
    const j: any = await r.json();
    if (!r.ok) throw new Error(j?.error?.description || "Razorpay create-order failed");

    await supabaseAdmin.from("orders").update({
      payment_provider_order_id: j.id,
    }).eq("id", order.id);

    return {
      keyId: creds.keyId,
      razorpayOrderId: j.id,
      amount: j.amount,
      currency: j.currency,
      prefill: { name: order.full_name, email: order.email, contact: order.phone },
      orderNumber: order.order_number,
    };
  });

export const verifyRazorpayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      orderId: z.string().uuid(),
      razorpay_order_id: z.string(),
      razorpay_payment_id: z.string(),
      razorpay_signature: z.string(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { createHmac, timingSafeEqual } = await import("node:crypto");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, payment_provider_order_id, payment_status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (orderError || !order) throw new Error("Order not found");
    if (order.user_id !== context.userId) throw new Error("Forbidden");
    if (order.payment_provider_order_id !== data.razorpay_order_id) {
      throw new Error("Payment does not match this order");
    }
    if (order.payment_status === "paid") return { ok: true };

    const creds = await getRazorpayCreds();
    const body = `${data.razorpay_order_id}|${data.razorpay_payment_id}`;
    const expected = createHmac("sha256", creds.keySecret).update(body).digest("hex");
    const a = Buffer.from(expected), b = Buffer.from(data.razorpay_signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Invalid signature");

    await supabaseAdmin.from("orders").update({
      payment_status: "paid",
      payment_provider_payment_id: data.razorpay_payment_id,
      status: "confirmed",
    }).eq("id", order.id);
    return { ok: true };
  });

