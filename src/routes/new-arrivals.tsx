import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { productsQuery } from "@/lib/queries";
import { ListingHero, ListingGrid } from "@/components/product/ListingGrid";

export const Route = createFileRoute("/new-arrivals")({
  head: () => ({
    meta: [
      { title: "New Arrivals — Aurona" },
      { name: "description", content: "The latest Aurona LED lighting, fans and appliances — freshly launched, in stock and ready to ship." },
      { property: "og:title", content: "New Arrivals — Aurona" },
      { property: "og:description", content: "Freshly launched Aurona products." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(productsQuery({ isNew: true })),
  component: NewPage,
});

function NewPage() {
  const products = useSuspenseQuery(productsQuery({ isNew: true })).data;
  return (
    <>
      <ListingHero
        eyebrow="Just launched"
        title="New Arrivals"
        description="Explore the newest additions to the Aurona catalog — engineered in India with our latest lighting and appliance technology."
        count={products.length}
      />
      <ListingGrid products={products} />
    </>
  );
}
