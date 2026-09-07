import { createFileRoute } from "@tanstack/react-router";
import { fail, loadCollections, ok } from "@/lib/fastrr-catalog.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, X-Api-Key, X-Api-HMAC-SHA256",
  "Access-Control-Max-Age": "86400",
} as const;

/**
 * Fastrr Custom Endpoint — Fetch Collections.
 *
 * GET /api/public/fastrr/collections?page=1&limit=100
 */
export const Route = createFileRoute("/api/public/fastrr/collections")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        try {
          const data = await loadCollections(new URL(request.url));
          const res = ok(data);
          for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
          return res;
        } catch (e) {
          console.error("[fastrr/collections]", e instanceof Error ? e.message : e);
          return fail("Could not load collections.", 500);
        }
      },
    },
  },
});
