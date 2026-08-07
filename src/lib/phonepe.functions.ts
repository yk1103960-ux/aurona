import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Public: tells the storefront which online payment options are live right now. */
export const getPaymentAvailability = createServerFn({ method: "GET" }).handler(async () => {
  const { getPhonePeConfig, getPhonePeV2Config } = await import("./phonepe.server");
  const v2 = await getPhonePeV2Config().catch(() => null);
  if (v2) return { phonepe: true, mode: v2.env };
  const cfg = await getPhonePeConfig().catch(() => null);
  return { phonepe: Boolean(cfg), mode: cfg?.env ?? null };
});


/** Creates a PhonePe payment for an existing order and returns the hosted checkout URL. */
export const startPhonePePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ orderId: z.string().uuid(), origin: z.string().url().max(300) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getPhonePeConfig, phonePeBase, xVerify, merchantTxnId } = await import("./phonepe.server");

    const cfg = await getPhonePeConfig();
    if (!cfg) throw new Error("Online payments are not configured yet.");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, total, user_id, phone, payment_status")
      .eq("id", data.orderId)
      .single();
    if (error || !order) throw new Error("Order not found");
    if (order.user_id !== context.userId) throw new Error("Forbidden");
    if (order.payment_status === "paid") return { alreadyPaid: true as const, redirectUrl: null };

    const txnId = merchantTxnId(order.order_number);
    const origin = new URL(data.origin).origin;
    const payload = {
      merchantId: cfg.merchantId,
      merchantTransactionId: txnId,
      merchantUserId: order.user_id.replace(/-/g, "").slice(0, 32),
      amount: Math.round(Number(order.total) * 100),
      redirectUrl: `${origin}/payment-status?order=${order.id}`,
      redirectMode: "REDIRECT",
      callbackUrl: `${origin}/api/public/phonepe-callback`,
      mobileNumber: (order.phone ?? "").replace(/\D/g, "").slice(-10),
      paymentInstrument: { type: "PAY_PAGE" },
    };
    const b64 = Buffer.from(JSON.stringify(payload)).toString("base64");
    const path = "/pg/v1/pay";
    const res = await fetch(`${phonePeBase(cfg.env)}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        "X-VERIFY": xVerify(b64, path, cfg.saltKey, cfg.saltIndex),
      },
      body: JSON.stringify({ request: b64 }),
    });
    const j = (await res.json()) as {
      success?: boolean;
      message?: string;
      data?: { instrumentResponse?: { redirectInfo?: { url?: string } } };
    };
    const url = j?.data?.instrumentResponse?.redirectInfo?.url;
    if (!res.ok || !j.success || !url) {
      throw new Error(j?.message || `PhonePe rejected the payment request (${res.status})`);
    }

    await supabaseAdmin
      .from("orders")
      .update({ payment_provider_order_id: txnId })
      .eq("id", order.id);

    return { alreadyPaid: false as const, redirectUrl: url };
  });

/** Confirms the payment state with PhonePe and updates the order. */
export const checkPhonePePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getPhonePeConfig, phonePeBase, xVerify, merchantTxnId } = await import("./phonepe.server");

    const cfg = await getPhonePeConfig();
    if (!cfg) throw new Error("Online payments are not configured yet.");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, user_id, payment_status, payment_provider_order_id, total")
      .eq("id", data.orderId)
      .single();
    if (error || !order) throw new Error("Order not found");
    if (order.user_id !== context.userId) throw new Error("Forbidden");
    if (order.payment_status === "paid") {
      return { state: "COMPLETED", paid: true, orderNumber: order.order_number };
    }

    const txnId = order.payment_provider_order_id || merchantTxnId(order.order_number);
    const path = `/pg/v1/status/${cfg.merchantId}/${txnId}`;
    const res = await fetch(`${phonePeBase(cfg.env)}${path}`, {
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": xVerify("", path, cfg.saltKey, cfg.saltIndex),
        "X-MERCHANT-ID": cfg.merchantId,
      },
    });
    const j = (await res.json()) as {
      success?: boolean;
      code?: string;
      data?: { state?: string; transactionId?: string };
    };
    const state = j?.data?.state ?? j?.code ?? "PENDING";
    const paid = j?.success === true && (state === "COMPLETED" || j?.code === "PAYMENT_SUCCESS");

    if (paid) {
      await supabaseAdmin
        .from("orders")
        .update({
          payment_status: "paid",
          status: "confirmed",
          payment_provider_payment_id: j?.data?.transactionId ?? txnId,
        })
        .eq("id", order.id);
    } else if (state === "FAILED" || j?.code === "PAYMENT_ERROR") {
      await supabaseAdmin.from("orders").update({ payment_status: "failed" }).eq("id", order.id);
    }

    return { state, paid, orderNumber: order.order_number };
  });
