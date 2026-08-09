import { createFileRoute } from "@tanstack/react-router";

/** PhonePe server-to-server callback. Verifies the X-VERIFY header before touching the order. */
export const Route = createFileRoute("/api/public/phonepe-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { createHash, timingSafeEqual } = await import("node:crypto");
        const { getPhonePeConfig, getPhonePeV2Config } = await import("@/lib/phonepe.server");

        const raw = await request.text();

        // Standard Checkout v2: callback is plain JSON, authenticated with
        // sha256(username:password) in the Authorization header.
        const v2 = await getPhonePeV2Config();
        if (v2) {
          const user = process.env["PHONEPE_CALLBACK_USERNAME"];
          const pass = process.env["PHONEPE_CALLBACK_PASSWORD"];
          if (!user || !pass) return new Response("callback auth not configured", { status: 503 });
          const got = (request.headers.get("authorization") ?? "").replace(/^SHA256\s+/i, "").trim();
          const want = createHash("sha256").update(`${user}:${pass}`).digest("hex");
          const ga = Buffer.from(got);
          const gb = Buffer.from(want);
          if (ga.length !== gb.length || !timingSafeEqual(ga, gb)) {
            return new Response("invalid signature", { status: 401 });
          }
          const evt = JSON.parse(raw) as {
            payload?: { merchantOrderId?: string; state?: string; paymentDetails?: Array<{ transactionId?: string }> };
          };
          const orderId = evt.payload?.merchantOrderId;
          if (!orderId) return new Response("ok");
          const paidV2 = evt.payload?.state === "COMPLETED";
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin
            .from("orders")
            .update(
              paidV2
                ? {
                    payment_status: "paid",
                    status: "confirmed",
                    payment_provider_payment_id:
                      evt.payload?.paymentDetails?.[0]?.transactionId ?? orderId,
                  }
                : { payment_status: "failed" },
            )
            .eq("payment_provider_order_id", orderId)
            .neq("payment_status", "paid");
          const { logPaymentEvent } = await import("@/lib/phonepe.server");
          await logPaymentEvent({
            merchantTxnId: `${orderId}-WH${Date.now().toString(36)}`,
            stage: "webhook",
            environment: v2.env,
            endpoint: "/api/public/phonepe-callback",
            method: "POST",
            status: 200,
            ok: paidV2,
            paymentState: paidV2 ? "COMPLETED" : (evt.payload?.state ?? "FAILED"),
          });
          return new Response("ok");
        }

        const cfg = await getPhonePeConfig();
        if (!cfg) return new Response("not configured", { status: 503 });

        let base64: string | undefined;
        try {
          base64 = (JSON.parse(raw) as { response?: string }).response;
        } catch {
          base64 = undefined;
        }
        if (!base64) return new Response("bad payload", { status: 400 });


        const header = request.headers.get("x-verify") ?? "";
        const expected = `${createHash("sha256").update(`${base64}${cfg.saltKey}`).digest("hex")}###${cfg.saltIndex}`;
        const a = Buffer.from(header);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("invalid signature", { status: 401 });
        }

        const decoded = JSON.parse(Buffer.from(base64, "base64").toString("utf8")) as {
          code?: string;
          data?: { merchantTransactionId?: string; state?: string; transactionId?: string };
        };
        const txnId = decoded?.data?.merchantTransactionId;
        if (!txnId) return new Response("ok");

        const paid = decoded?.code === "PAYMENT_SUCCESS" || decoded?.data?.state === "COMPLETED";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("orders")
          .update(
            paid
              ? {
                  payment_status: "paid",
                  status: "confirmed",
                  payment_provider_payment_id: decoded?.data?.transactionId ?? txnId,
                }
              : { payment_status: "failed" },
          )
          .eq("payment_provider_order_id", txnId)
          .neq("payment_status", "paid");

        const { logPaymentEvent } = await import("@/lib/phonepe.server");
        await logPaymentEvent({
          merchantTxnId: `${txnId}-WH${Date.now().toString(36)}`,
          stage: "webhook",
          environment: cfg.env,
          endpoint: "/api/public/phonepe-callback",
          method: "POST",
          status: 200,
          ok: paid,
          providerCode: decoded?.code ?? null,
          paymentState: paid ? "COMPLETED" : (decoded?.data?.state ?? "FAILED"),
        });

        return new Response("ok");
      },
    },
  },
});
