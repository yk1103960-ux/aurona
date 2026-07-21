import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { categoriesQuery, productsPageQuery } from "@/lib/queries";
import { ProductCard } from "@/components/product/ProductCard";
import { Pagination, PER_PAGE_OPTIONS } from "@/components/product/Pagination";

const search = z.object({
  page: fallback(z.number(), 1).default(1),
  perPage: fallback(z.number(), 24).default(24),
});

export const Route = createFileRoute("/category/$slug")({
  validateSearch: zodValidator(search),
  loaderDeps: ({ search: s }) => s,
  loader: async ({ context, params, deps }) => {
    const cats = await context.queryClient.ensureQueryData(categoriesQuery);
    if (!cats.find((c) => c.slug === params.slug)) throw notFound();
    const perPage = PER_PAGE_OPTIONS.includes(deps.perPage as 12) ? deps.perPage : 24;
    context.queryClient.ensureQueryData(
      productsPageQuery({ categorySlug: params.slug, page: Math.max(1, deps.page), perPage, sort: "newest" }),
    );
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
  const sp = Route.useSearch();
  const nav = Route.useNavigate();
  const cats = useSuspenseQuery(categoriesQuery).data;
  const perPage = PER_PAGE_OPTIONS.includes(sp.perPage as 12) ? sp.perPage : 24;
  const page = Math.max(1, sp.page);
  const { rows, total } = useSuspenseQuery(
    productsPageQuery({ categorySlug: slug, page, perPage, sort: "newest" }),
  ).data;
  const cat = cats.find((c) => c.slug === slug)!;

  return (
    <div className="container-x py-8">
      <div className="mb-6 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link> /{" "}
        <Link to="/products" className="hover:text-foreground">Products</Link> /{" "}
        <span className="text-foreground">{cat.name}</span>
      </div>
      <h1 className="text-display text-4xl sm:text-5xl">{cat.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{total} products</p>

      {total === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          No products in this category yet.
        </div>
      ) : (
        <>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {rows.map((p) => <ProductCard key={p.id} product={p} categoryIcon={cat.icon} />)}
          </div>
          <Pagination
            page={page}
            perPage={perPage}
            total={total}
            onPage={(p) => {
              nav({ search: (s: any) => ({ ...s, page: p }) });
              if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onPerPage={(n) => nav({ search: (s: any) => ({ ...s, perPage: n, page: 1 }) })}
          />
        </>
      )}
    </div>
  );
}
