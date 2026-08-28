import { createFileRoute } from "@tanstack/react-router";
import { AccountDashboard } from "@/routes/account";

export const Route = createFileRoute("/distributor")({
  head: () => ({
    meta: [
      { title: "Distributor Dashboard — Aurona Lighting" },
      { name: "description", content: "Aurona distributor dashboard: distributor pricing, channel orders, invoices, tracking and verification status." },
      { property: "og:title", content: "Distributor Dashboard — Aurona Lighting" },
      { property: "og:description", content: "Manage your Aurona distributor account, channel pricing and orders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <AccountDashboard expectedRole="distributor" />,
});
