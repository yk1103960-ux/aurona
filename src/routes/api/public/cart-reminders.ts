import { createFileRoute } from "@tanstack/react-router";

// Cron-callable abandoned-cart recovery job. Guarded by a shared token; the
// response only exposes aggregate counters, never shopper data.
export const Route = createFileRoute("/api/public/cart-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["CART_REMINDER_CRON_TOKEN"];
        if (!expected) return new Response("Not configured", { status: 503 });
        const provided =
          request.headers.get("x-cron-token") ??
          new URL(request.url).searchParams.get("token") ??
          "";
        if (provided.length !== expected.length || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { runCartReminders } = await import("@/lib/cart-reminders.server");
        try {
          const result = await runCartReminders(100);
          return Response.json({ ok: true, ...result });
        } catch (error) {
          console.log(
            `[cart-reminders] failed: ${error instanceof Error ? error.message : "unknown"}`,
          );
          return Response.json({ ok: false }, { status: 502 });
        }
      },
    },
  },
});
