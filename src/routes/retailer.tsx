import { createFileRoute } from "@tanstack/react-router";
import { AccountDashboard } from "@/routes/account";

export const Route = createFileRoute("/retailer")({
  head: () => ({
    meta: [
      { title: "Retailer Dashboard — Aurona Lighting" },
      { name: "description", content: "Aurona retailer dashboard: retailer pricing, bulk orders, invoices, tracking and account verification status." },
      { property: "og:title", content: "Retailer Dashboard — Aurona Lighting" },
      { property: "og:description", content: "Manage your Aurona retailer account, trade pricing and orders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <AccountDashboard expectedRole="retailer" />,
});
