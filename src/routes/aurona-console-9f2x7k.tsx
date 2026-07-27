import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/aurona-console-9f2x7k")({
  head: () => ({
    meta: [
      { title: "Admin Login — Aurona Console" },
      { name: "description", content: "Confidential Aurona administrator login and management console." },
      { property: "og:title", content: "Admin Login — Aurona Console" },
      { property: "og:description", content: "Confidential Aurona administrator login and management console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminShell,
});
