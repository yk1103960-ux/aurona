import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { productsQuery } from "@/lib/queries";
import { ListingHero, ListingGrid } from "@/components/product/ListingGrid";

export const Route = createFileRoute("/bestsellers")({
  head: () => ({
    meta: [
      { title: "Best Sellers — Aurona" },
      { name: "description", content: "India's favourite Aurona lighting, fans and home appliances — the products customers can't stop buying." },
      { property: "og:title", content: "Best Sellers — Aurona" },
      { property: "og:description", content: "The Aurona products India loves most." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(productsQuery({ bestseller: true })),
  component: BestPage,
});

function BestPage() {
  const products = useSuspenseQuery(productsQuery({ bestseller: true })).data;
  return (
    <>
      <ListingHero
        eyebrow="Popular"
        title="Best Sellers"
        description="Top-rated Aurona products, ranked by real customer purchases across 1000+ retail partners nationwide."
        count={products.length}
      />
      <ListingGrid products={products} />
    </>
  );
}
