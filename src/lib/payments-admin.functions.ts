import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin: creates a real (₹1) PhonePe checkout *session* — no money moves and no
 * customer is charged — purely to prove the credentials, environment and
 * checkout ring line up. Returns sanitized diagnostics only.
 */
export const testPhonePeConfiguration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./admin.server");
    await assertAdmin(context);
    const pp = await import("./phonepe.server");

    const v2 = await pp.getPhonePeV2Config().catch(() => null);
    const cfg = v2 ? null : await pp.getPhonePeConfig().catch(() => null);

    if (!v2 && !cfg) {
      return {
        configured: false,
        api: null as string | null,
        environment: null as string | null,
        merchantRef: null as string | null,
        stage: "creation",
        httpStatus: null as number | null,
        ok: false,
        checkoutHost: null as string | null,
        ring: null as string | null,
        message: "No PhonePe credentials are saved. Add them in Admin → Integrations.",
        txnId: null as string | null,
        testedAt: new Date().toISOString(),
      };
    }

    const txnId = `AURTEST${Date.now().toString(36).toUpperCase()}`;
    const origin = "https://aurona.lovable.app";

    if (v2) {
      try {
        const url = await pp.phonePeV2Pay({
          cfg: v2,
          merchantOrderId: txnId,
          amountPaise: 100,
          redirectUrl: `${origin}/payment-status`,
          message: "Aurona configuration test",
        });
        const ring = pp.classifyCheckoutRing(url);
        await pp.recordCheckoutRing(ring, `Config test: session created on ${pp.checkoutHost(url)}`);
        await pp.logPaymentEvent({
          merchantTxnId: txnId,
          stage: "config_test",
          environment: v2.env,
          endpoint: "checkout/v2/pay",
          method: "POST",
          status: 200,
          ok: ring === "production" || v2.env === "sandbox",
          checkoutHost: pp.checkoutHost(url),
          amount: 1,
          providerMessage: `ring=${ring}`,
        });
        return {
          configured: true,
          api: "Standard Checkout v2 (OAuth)",
          environment: v2.env,
          merchantRef: `${v2.clientId.slice(0, 4)}••••${v2.clientId.slice(-3)}`,
          stage: "creation",
          httpStatus: 200,
          ok: ring === "production" || v2.env === "sandbox",
          checkoutHost: pp.checkoutHost(url),
          ring,
          message:
            ring === "production" || v2.env === "sandbox"
              ? "Payment session created successfully."
              : `PhonePe returned a ${ring} checkout page for a live configuration. The merchant account is not activated for production payments.`,
          txnId,
          testedAt: new Date().toISOString(),
        };
      } catch (e) {
        const msg = pp.sanitizeProviderMessage(e instanceof Error ? e.message : e);
        await pp.logPaymentEvent({
          merchantTxnId: txnId,
          stage: "config_test",
          environment: v2.env,
          endpoint: "checkout/v2/pay",
          method: "POST",
          ok: false,
          providerMessage: msg,
        });
        return {
          configured: true,
          api: "Standard Checkout v2 (OAuth)",
          environment: v2.env,
          merchantRef: `${v2.clientId.slice(0, 4)}••••${v2.clientId.slice(-3)}`,
          stage: "creation",
          httpStatus: null,
          ok: false,
          checkoutHost: null,
          ring: null,
          message: msg,
          txnId,
          testedAt: new Date().toISOString(),
        };
      }
    }

    const res = await pp.phonePeLegacyPay({
      cfg: cfg!,
      merchantTransactionId: txnId,
      merchantUserId: "AURONACONFIGTEST",
      amountPaise: 100,
      redirectUrl: `${origin}/payment-status`,
      callbackUrl: `${origin}/api/public/phonepe-callback`,
    });
    const ring = res.url ? pp.classifyCheckoutRing(res.url) : "unknown";
    const healthy = res.ok && (ring === "production" || cfg!.env === "sandbox");
    if (res.url) {
      await pp.recordCheckoutRing(
        ring,
        healthy
          ? `Config test: session created on ${pp.checkoutHost(res.url)}`
          : `Config test: PhonePe returned a ${ring} checkout page (${pp.checkoutHost(res.url)}) for a "${cfg!.env}" configuration.`,
      );
    }
    await pp.logPaymentEvent({
      merchantTxnId: txnId,
      stage: "config_test",
      environment: cfg!.env,
      endpoint: res.endpoint,
      method: "POST",
      status: res.status,
      ok: healthy,
      checkoutHost: res.url ? pp.checkoutHost(res.url) : null,
      amount: 1,
      providerCode: res.code,
      providerMessage: res.message ?? `ring=${ring}`,
    });

    return {
      configured: true,
      api: "PG Legacy (hermes, Salt Key)",
      environment: cfg!.env,
      merchantRef: cfg!.merchantId,
      stage: res.ok ? "redirect" : "creation",
      httpStatus: res.status,
      ok: healthy,
      checkoutHost: res.url ? pp.checkoutHost(res.url) : null,
      ring,
      message: healthy
        ? "Payment session created successfully on the production checkout ring."
        : res.ok
          ? `PhonePe accepted the signed request but returned a ${ring} (UAT) checkout page for a "${cfg!.env}" configuration. Live payments will fail at instrument selection until PhonePe activates this merchant for production.`
          : (res.message ?? `PhonePe rejected the request (HTTP ${res.status}).`),
      txnId,
      testedAt: new Date().toISOString(),
    };
  });

/** Admin: recent sanitized payment diagnostics. */
export const listPaymentDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().min(1).max(100).default(25) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./admin.server");
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("payment_events")
      .select(
        "id, stage, environment, endpoint, http_method, http_status, ok, checkout_host, amount, provider_code, provider_message, payment_state, merchant_txn_id, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);
    return rows ?? [];
  });
