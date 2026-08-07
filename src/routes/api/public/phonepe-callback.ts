import { createFileRoute } from "@tanstack/react-router";

/** PhonePe server-to-server callback. Verifies the X-VERIFY header before touching the order. */
export const Route = createFileRoute("/api/public/phonepe-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { createHash, timingSafeEqual } = await import("node:crypto");
        const { getPhonePeConfig } = await import("@/lib/phonepe.server");
        const cfg = await getPhonePeConfig();
        if (!cfg) return new Response("not configured", { status: 503 });

        const raw = await request.text();
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
          .eq("payment_provider_order_id", txnId);

        return new Response("ok");
      },
    },
  },
});
