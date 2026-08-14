import { createFileRoute } from "@tanstack/react-router";

// Cron-callable tracking sync for all in-flight shipments.
// Guarded by a shared token; no credentials or provider payloads are returned.
export const Route = createFileRoute("/api/public/sync-shipments")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["SHIPROCKET_CRON_TOKEN"];
        if (!expected) return new Response("Not configured", { status: 503 });
        const provided =
          request.headers.get("x-cron-token") ??
          new URL(request.url).searchParams.get("token") ??
          "";
        if (provided !== expected) return new Response("Unauthorized", { status: 401 });

        const { syncAllOpenShipments } = await import("@/lib/shipment.server");
        try {
          const result = await syncAllOpenShipments(50);
          return Response.json({ ok: true, scanned: result.scanned, synced: result.synced });
        } catch (error) {
          console.log(`[sync-shipments] failed: ${error instanceof Error ? error.message : "unknown"}`);
          return Response.json({ ok: false }, { status: 502 });
        }
      },
    },
  },
});
