import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/razorpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signature = request.headers.get("x-razorpay-signature") ?? "";
        const body = await request.text();

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: gw } = await supabaseAdmin
          .from("payment_gateways")
          .select("config_secret_ciphertext")
          .eq("provider", "razorpay")
          .maybeSingle();
        if (!gw?.config_secret_ciphertext) return new Response("Not configured", { status: 400 });

        const { decryptJSON } = await import("@/lib/crypto.server");
        const secrets = decryptJSON<{ webhookSecret: string | null; keySecret: string }>(gw.config_secret_ciphertext);
        const secret = secrets.webhookSecret;
        if (!secret) return new Response("No webhook secret", { status: 400 });

        const { createHmac, timingSafeEqual } = await import("node:crypto");
        const expected = createHmac("sha256", secret).update(body).digest("hex");
        const a = Buffer.from(expected), b = Buffer.from(signature);
        if (a.length !== b.length || !timingSafeEqual(a, b)) return new Response("Invalid signature", { status: 401 });

        const event = JSON.parse(body);
        const payment = event?.payload?.payment?.entity;
        const rzpOrderId = payment?.order_id;
        const status = payment?.status;
        if (rzpOrderId && status === "captured") {
          await supabaseAdmin
            .from("orders")
            .update({
              payment_status: "paid",
              payment_provider_payment_id: payment.id,
              status: "confirmed",
            })
            .eq("payment_provider_order_id", rzpOrderId);
        }
        return new Response("ok");
      },
    },
  },
});
