import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { productsQuery } from "@/lib/queries";
import { ListingHero, ListingGrid } from "@/components/product/ListingGrid";

export const Route = createFileRoute("/deals")({
  head: () => ({
    meta: [
      { title: "Deals of the Day — Aurona" },
      { name: "description", content: "Limited-time savings on Aurona LED lighting, fans and appliances. Up to 60% off." },
      { property: "og:title", content: "Deals of the Day — Aurona" },
      { property: "og:description", content: "Up to 60% off premium LED lighting, fans and appliances." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(productsQuery({ sale: true })),
  component: DealsPage,
});

function DealsPage() {
  const products = useSuspenseQuery(productsQuery({ sale: true })).data;
  return (
    <>
      <ListingHero
        eyebrow="Limited time"
        title="Deals of the Day"
        description="Grab premium Aurona products at unbeatable prices — refreshed daily. Free PAN India delivery on every order."
        count={products.length}
      />
      <ListingGrid products={products} />
    </>
  );
}
