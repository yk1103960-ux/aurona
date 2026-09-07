import { createFileRoute } from "@tanstack/react-router";
import { fail, loadProducts, ok } from "@/lib/fastrr-catalog.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, X-Api-Key, X-Api-HMAC-SHA256",
  "Access-Control-Max-Age": "86400",
} as const;

/**
 * Fastrr Custom Endpoint — Fetch Products.
 *
 * GET /api/public/fastrr/products
 *   ?page=1&limit=50
 *   &ids=<family uuid,...>            optional
 *   &sku=<sku,...>                    optional
 *   &handle=<slug,...>                optional
 *   &collection_id=<category uuid>    optional
 *   &collection_handle=<slug>         optional
 *   &q=<search text>                  optional
 *
 * Read-only, published products only. Retailer/distributor pricing and MOQ are
 * never included.
 */
export const Route = createFileRoute("/api/public/fastrr/products")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        try {
          const data = await loadProducts(new URL(request.url));
          const res = ok(data);
          for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
          return res;
        } catch (e) {
          console.error("[fastrr/products]", e instanceof Error ? e.message : e);
          return fail("Could not load products.", 500);
        }
      },
    },
  },
});
