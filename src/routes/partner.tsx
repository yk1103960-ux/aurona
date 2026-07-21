import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/partner")({
  head: () => ({
    meta: [
      { title: "Partner With Us — Aurona Lighting Industries" },
      { name: "description", content: "Become an Aurona retailer, distributor, sales partner, affiliate, or corporate/OEM partner. Grow with a trusted premium lighting brand." },
      { property: "og:title", content: "Partner With Aurona" },
      { property: "og:description", content: "Retailer, distributor, and channel partnership programs for Aurona Lighting Industries." },
    ],
  }),
  component: () => <Outlet />,
});
