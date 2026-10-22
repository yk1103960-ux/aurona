import { createFileRoute } from "@tanstack/react-router";
import { EcommainAdminShell } from "@/components/admin/EcommainAdminShell";

export const Route = createFileRoute("/aurona-console-9f2x7k")({
  head: () => ({
    meta: [
      { title: "Admin Login — Aurona Ecommain" },
      { name: "description", content: "Confidential Aurona Ecommain administration console." },
      { property: "og:title", content: "Admin Login — Aurona Ecommain" },
      { property: "og:description", content: "Confidential Aurona Ecommain administration console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: EcommainAdminShell,
});
