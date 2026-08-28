import { createFileRoute } from "@tanstack/react-router";
import { FaqDirectory } from "@/components/marketing/FaqSection";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Aurona Lighting Industries" },
      { name: "description", content: "Find answers to frequently asked questions about Aurona Lighting products, orders, warranty, shipping, and support." },
      { property: "og:title", content: "FAQ — Aurona" },
      { property: "og:description", content: "Browse frequently asked questions about Aurona Lighting Industries." },
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <main>
      <FaqDirectory />
    </main>
  );
}
