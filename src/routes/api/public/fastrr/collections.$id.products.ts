import { createFileRoute } from "@tanstack/react-router";
import { fail, loadProducts, ok } from "@/lib/fastrr-catalog.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, X-Api-Key, X-Api-HMAC-SHA256",
  "Access-Control-Max-Age": "86400",
} as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Fastrr Custom Endpoint — Fetch Products by Collection.
 *
 * GET /api/public/fastrr/collections/{id}/products?page=1&limit=50
 * {id} accepts either the collection UUID or its handle/slug.
 */
export const Route = createFileRoute("/api/public/fastrr/collections/$id/products")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request, params }) => {
        const id = String(params.id ?? "").trim();
        if (!id || id.length > 200) return fail("A collection id or handle is required.", 400);
        try {
          const data = await loadProducts(
            new URL(request.url),
            UUID.test(id) ? { categoryId: id } : { categorySlug: id },
          );
          const res = ok(data);
          for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
          return res;
        } catch (e) {
          console.error("[fastrr/collection-products]", e instanceof Error ? e.message : e);
          return fail("Could not load collection products.", 500);
        }
      },
    },
  },
});
