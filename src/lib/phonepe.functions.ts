import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Public: tells the storefront which online payment options are actually usable.
 * A gateway that is configured but answering with a *test-ring* checkout page is
 * reported as unavailable, so the customer is never handed a payment page that
 * dies with "Something went wrong".
 */
export const getPaymentAvailability = createServerFn({ method: "GET" }).handler(async () => {
  const { getPhonePeConfig, getPhonePeV2Config } = await import("./phonepe.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const v2 = await getPhonePeV2Config().catch(() => null);
  const cfg = v2 ? null : await getPhonePeConfig().catch(() => null);
  if (!v2 && !cfg) return { phonepe: false, mode: null as string | null, reason: "not_configured" };

  const env = v2?.env ?? cfg?.env ?? null;
  const { data } = await supabaseAdmin
    .from("integrations")
    .select("config_public")
    .eq("provider", "phonepe")
    .maybeSingle();
  const ring = (data?.config_public as { checkoutRing?: string } | null)?.checkoutRing;

  if (env === "live" && ring === "test") {
    return { phonepe: false, mode: env, reason: "environment_mismatch" };
  }
  return { phonepe: true, mode: env, reason: null };
});

// Short-lived memo so a double-tap on "Pay" reuses the same PhonePe session
// instead of creating a second one.
const inFlight = new Map<string, { url: string; at: number }>();
const IN_FLIGHT_MS = 90_000;

/** Creates a PhonePe payment for an existing order and returns the hosted checkout URL. */
export const startPhonePePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ orderId: z.string().uuid(), origin: z.string().url().max(300) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const pp = await import("./phonepe.server");

    const v2 = await pp.getPhonePeV2Config();
    const cfg = v2 ? null : await pp.getPhonePeConfig();
    if (!v2 && !cfg) {
      throw new Error(
        "Online payment is not available right now. Please choose Cash on Delivery, or try again later.",
      );
    }
    const env = v2?.env ?? cfg!.env;

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, total, user_id, phone, payment_status")
      .eq("id", data.orderId)
      .single();
    if (error || !order) throw new Error("Order not found");
    if (order.user_id !== context.userId) throw new Error("Forbidden");
    if (order.payment_status === "paid") return { alreadyPaid: true as const, redirectUrl: null };

    // Amount is always recomputed from the server-side order row — never the browser.
    const amountPaise = Math.round(Number(order.total) * 100);
    if (!Number.isFinite(amountPaise) || amountPaise < 100) {
      throw new Error("This order amount cannot be paid online. Please contact support.");
    }

    const memo = inFlight.get(order.id);
    if (memo && Date.now() - memo.at < IN_FLIGHT_MS) {
      return { alreadyPaid: false as const, redirectUrl: memo.url };
    }

    // PhonePe treats the merchant order id as immutable, so every attempt gets a
    // brand-new unique id while the order row keeps the id currently in flight.
    const txnId = pp.newMerchantTxnId(order.order_number);
    // PhonePe only allows payments from the URL approved on the merchant account
    // (https://aurona.in). Preview/staging origins get rejected with a
    // "Mismatch in Onboarding & Transacting URL" notice, so we always build
    // PhonePe-facing URLs from the approved origin, never the caller's origin.
    const approvedOrigin = new URL(
      process.env["PHONEPE_APPROVED_ORIGIN"] || "https://aurona.in",
    ).origin;
    const origin = approvedOrigin;
    const redirectUrl = `${origin}/payment-status?order=${order.id}`;
    const callbackUrl = `${origin}/api/public/phonepe-callback`;

    let checkoutUrl: string | null = null;

    if (v2) {
      try {
        checkoutUrl = await pp.phonePeV2Pay({
          cfg: v2,
          merchantOrderId: txnId,
          amountPaise,
          redirectUrl,
          message: `Aurona order ${order.order_number}`,
        });
      } catch (e) {
        await pp.logPaymentEvent({
          orderId: order.id,
          merchantTxnId: txnId,
          stage: "creation",
          environment: env,
          endpoint: "checkout/v2/pay",
          method: "POST",
          status: null,
          ok: false,
          amount: Number(order.total),
          providerMessage: e instanceof Error ? e.message : String(e),
        });
        throw new Error("Unable to start payment. Please try again.");
      }
    } else {
      const res = await pp.phonePeLegacyPay({
        cfg: cfg!,
        merchantTransactionId: txnId,
        merchantUserId: order.user_id.replace(/-/g, "").slice(0, 32),
        amountPaise,
        redirectUrl,
        callbackUrl,
        mobileNumber: (order.phone ?? "").replace(/\D/g, "").slice(-10),
      });
      await pp.logPaymentEvent({
        orderId: order.id,
        merchantTxnId: txnId,
        stage: "creation",
        environment: env,
        endpoint: res.endpoint,
        method: "POST",
        status: res.status,
        ok: res.ok,
        checkoutHost: res.url ? pp.checkoutHost(res.url) : null,
        amount: Number(order.total),
        providerCode: res.code,
        providerMessage: res.message,
      });
      if (!res.ok || !res.url) {
        throw new Error("Unable to start payment. Please try again.");
      }
      checkoutUrl = res.url;
    }

    // Environment integrity: production credentials must yield a production
    // checkout page. A UAT/test page here is the root cause of the customer
    // seeing PhonePe's "Something went wrong" screen.
    const ring = pp.classifyCheckoutRing(checkoutUrl);
    await pp.recordCheckoutRing(
      ring,
      ring === "production"
        ? `Live checkout session created on ${pp.checkoutHost(checkoutUrl)}`
        : `PhonePe returned a ${ring} checkout page (${pp.checkoutHost(checkoutUrl)}) for a "${env}" configuration. The merchant account is not activated for production payments.`,
    );

    if (env === "live" && ring !== "production") {
      await pp.logPaymentEvent({
        orderId: order.id,
        merchantTxnId: `${txnId}-RING`,
        stage: "redirect",
        environment: env,
        endpoint: checkoutUrl.split("?")[0] ?? null,
        method: "GET",
        ok: false,
        checkoutHost: pp.checkoutHost(checkoutUrl),
        amount: Number(order.total),
        providerCode: "ENVIRONMENT_MISMATCH",
        providerMessage:
          "PhonePe served a test-ring checkout page for a live configuration; the payment page would fail at instrument selection.",
      });
      await supabaseAdmin
        .from("orders")
        .update({ payment_status: "pending" })
        .eq("id", order.id);
      throw new Error(
        "Online payment is temporarily unavailable. Your order is saved — please choose Cash on Delivery or contact us to complete payment.",
      );
    }

    await supabaseAdmin
      .from("orders")
      .update({ payment_provider_order_id: txnId })
      .eq("id", order.id);
    await pp.logPaymentEvent({
      orderId: order.id,
      merchantTxnId: txnId,
      stage: "redirect",
      environment: env,
      endpoint: checkoutUrl.split("?")[0] ?? null,
      method: "GET",
      ok: true,
      checkoutHost: pp.checkoutHost(checkoutUrl),
      amount: Number(order.total),
      paymentState: "PENDING",
    });

    inFlight.set(order.id, { url: checkoutUrl, at: Date.now() });
    return { alreadyPaid: false as const, redirectUrl: checkoutUrl };
  });

/** Confirms the payment state with PhonePe (server-side truth) and updates the order. */
export const checkPhonePePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const pp = await import("./phonepe.server");

    const v2 = await pp.getPhonePeV2Config();
    const cfg = v2 ? null : await pp.getPhonePeConfig();
    if (!v2 && !cfg) throw new Error("Online payment is not available right now.");
    const env = v2?.env ?? cfg!.env;

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, user_id, payment_status, payment_provider_order_id, total")
      .eq("id", data.orderId)
      .single();
    if (error || !order) throw new Error("Order not found");
    if (order.user_id !== context.userId) throw new Error("Forbidden");
    if (order.payment_status === "paid") {
      return { state: "COMPLETED" as const, paid: true, orderNumber: order.order_number };
    }

    const txnId = order.payment_provider_order_id || pp.merchantTxnId(order.order_number);

    let state: "COMPLETED" | "FAILED" | "PENDING" | "CANCELLED" | "EXPIRED" = "PENDING";
    let transactionId: string | null = null;
    let status: number | null = null;
    let endpoint: string | null = null;
    let providerCode: string | null = null;
    let providerMessage: string | null = null;

    if (v2) {
      try {
        const r = await pp.phonePeV2Status(v2, txnId);
        state = pp.normalizePaymentState(r.state);
        transactionId = r.transactionId;
        endpoint = "checkout/v2/order/status";
      } catch (e) {
        providerMessage = e instanceof Error ? e.message : String(e);
      }
    } else {
      const r = await pp.phonePeLegacyStatus(cfg!, txnId);
      state = r.state;
      transactionId = r.transactionId;
      status = r.status;
      endpoint = r.endpoint;
      providerCode = r.code;
      providerMessage = r.message;
    }

    // Only PhonePe's own verification can mark an order paid — never the redirect.
    if (state === "COMPLETED") {
      await supabaseAdmin
        .from("orders")
        .update({
          payment_status: "paid",
          status: "confirmed",
          payment_provider_payment_id: transactionId ?? txnId,
        })
        .eq("id", order.id)
        .neq("payment_status", "paid");
    } else if (state === "FAILED" || state === "CANCELLED" || state === "EXPIRED") {
      await supabaseAdmin
        .from("orders")
        .update({ payment_status: "failed" })
        .eq("id", order.id)
        .neq("payment_status", "paid");
    }

    await pp.logPaymentEvent({
      orderId: order.id,
      merchantTxnId: `${txnId}-V${Date.now().toString(36)}`,
      stage: "verification",
      environment: env,
      endpoint,
      method: "GET",
      status,
      ok: state === "COMPLETED",
      amount: Number(order.total),
      providerCode,
      providerMessage,
      paymentState: state,
    });

    return { state, paid: state === "COMPLETED", orderNumber: order.order_number };
  });
