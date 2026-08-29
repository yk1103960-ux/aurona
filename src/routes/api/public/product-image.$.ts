import { createFileRoute } from "@tanstack/react-router";

/**
 * Serves product photos that admins upload into the private `media` bucket.
 *
 * Public storage buckets are not available on this project, so the storefront
 * points <img src> at this route and we stream the object with a long cache.
 * Only the `products/` prefix is readable, so nothing else in the bucket leaks.
 */
export const Route = createFileRoute("/api/public/product-image/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const raw = (params as { _splat?: string })._splat ?? "";
        const path = decodeURIComponent(raw).replace(/^\/+/, "");

        if (!path.startsWith("products/") || path.includes("..")) {
          return new Response("Not found", { status: 404 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("media").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });

        return new Response(await data.arrayBuffer(), {
          headers: {
            "Content-Type": data.type || "image/jpeg",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
