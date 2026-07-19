import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { productsQuery } from "@/lib/queries";
import { ListingHero, ListingGrid } from "@/components/product/ListingGrid";

export const Route = createFileRoute("/featured")({
  head: () => ({
    meta: [
      { title: "Featured Products — Aurona" },
      { name: "description", content: "Hand-picked Aurona products our team recommends — the highest quality lighting, fans and appliances." },
      { property: "og:title", content: "Featured Products — Aurona" },
      { property: "og:description", content: "Hand-picked Aurona recommendations." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(productsQuery({ featured: true })),
  component: FeaturedPage,
});

function FeaturedPage() {
  const products = useSuspenseQuery(productsQuery({ featured: true })).data;
  return (
    <>
      <ListingHero
        eyebrow="Editor's picks"
        title="Featured Products"
        description="Curated by the Aurona team — the products that best represent our commitment to design, engineering and everyday reliability."
        count={products.length}
      />
      <ListingGrid products={products} />
    </>
  );
}
