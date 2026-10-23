import { createFileRoute } from "@tanstack/react-router";
import { EcommainAdminShell } from "@/components/admin/EcommainAdminShell";

export const Route = createFileRoute("/aurona-console-9f2x7k")({
  head: () => ({
    meta: [
      { title: "Store Admin — Aurona" },
      { name: "description", content: "Secure administration for the Aurona store." },
      { property: "og:title", content: "Store Admin — Aurona" },
      { property: "og:description", content: "Secure administration for the Aurona store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: EcommainAdminShell,
});
