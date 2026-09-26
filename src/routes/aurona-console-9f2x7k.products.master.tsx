import { createFileRoute } from "@tanstack/react-router";
import { ProductMaster } from "@/components/admin/ProductMasterPage";

export const Route = createFileRoute("/aurona-console-9f2x7k/products/master")({
  head: () => ({
    meta: [
      { title: "Product Master — Aurona Console" },
      { name: "description", content: "Manage Aurona products, variants, pricing, inventory, and availability." },
      { property: "og:title", content: "Product Master — Aurona Console" },
      { property: "og:description", content: "Manage Aurona products, variants, pricing, inventory, and availability." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ProductMaster,
});
