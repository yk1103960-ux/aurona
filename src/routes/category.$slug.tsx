import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { categoriesQuery, productsQuery } from "@/lib/queries";
import { ProductCard } from "@/components/product/ProductCard";

export const Route = createFileRoute("/category/$slug")({
  loader: async ({ context, params }) => {
    const cats = await context.queryClient.ensureQueryData(categoriesQuery);
    if (!cats.find((c) => c.slug === params.slug)) throw notFound();
    context.queryClient.ensureQueryData(productsQuery({ categorySlug: params.slug }));
  },
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — Aurona` },
      { name: "description", content: `Shop Aurona ${params.slug.replace(/-/g, " ")} — premium quality, engineered in India.` },
    ],
  }),
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const cats = useSuspenseQuery(categoriesQuery).data;
  const products = useSuspenseQuery(productsQuery({ categorySlug: slug })).data;
  const cat = cats.find((c) => c.slug === slug)!;
  return (
    <div className="container-x py-8">
      <div className="mb-6 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link> /{" "}
        <Link to="/products" className="hover:text-foreground">Products</Link> /{" "}
        <span className="text-foreground">{cat.name}</span>
      </div>
      <h1 className="text-display text-4xl sm:text-5xl">{cat.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{products.length} products</p>

      {products.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          No products in this category yet.
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => <ProductCard key={p.id} product={p} categoryIcon={cat.icon} />)}
        </div>
      )}
    </div>
  );
}
