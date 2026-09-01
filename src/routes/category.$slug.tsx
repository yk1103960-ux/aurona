import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { categoriesQuery, productsPageQuery } from "@/lib/queries";
import { ProductCard } from "@/components/product/ProductCard";
import { Pagination, PER_PAGE_OPTIONS } from "@/components/product/Pagination";

const iconPointers = import.meta.glob<{ default: { url: string } }>(
  "../assets/category-icons/*.png.asset.json",
  { eager: true },
);
const categoryIcons: Record<string, string> = Object.fromEntries(
  Object.entries(iconPointers).map(([path, mod]) => [
    path.split("/").pop()!.replace(".png.asset.json", ""),
    mod.default.url,
  ]),
);


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
    <div className="container-x py-10">
      <div className="mb-7 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary">Home</Link> /{" "}
        <Link to="/products" className="hover:text-primary">Products</Link> /{" "}
        <span className="text-foreground">{cat.name}</span>
      </div>

      <div className="flex flex-col gap-6 rounded-3xl border border-primary/10 bg-gradient-to-br from-white via-surface/50 to-surface p-6 sm:flex-row sm:items-center sm:gap-7 sm:p-8">
        <span className="grid h-24 w-24 shrink-0 place-items-center rounded-3xl border border-primary/12 bg-gradient-to-br from-white to-[oklch(0.955_0.018_235)] shadow-[0_18px_40px_-24px_oklch(0.58_0.16_240/0.65)]">
          {categoryIcons[cat.slug] ? (
            <img
              src={categoryIcons[cat.slug]}
              alt={`${cat.name} icon`}
              className="h-16 w-16 object-contain drop-shadow-[0_10px_18px_oklch(0.58_0.16_240/0.28)]"
            />
          ) : (
            <span className="text-display text-3xl text-primary">{cat.name.charAt(0)}</span>
          )}
        </span>

        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">Category</div>
          <h1 className="text-display mt-2 text-4xl leading-tight sm:text-5xl">{cat.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{total} products · Manufacturer-direct pricing · PAN India delivery</p>
        </div>
      </div>

      {/* Sibling categories for easier navigation */}
      <div className="scrollbar-visible -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1">
        {cats
          .filter((c) => c.parent_group === cat.parent_group)
          .map((c) => (
            <Link
              key={c.id}
              to="/category/$slug"
              params={{ slug: c.slug }}
              className={
                "shrink-0 rounded-full border px-4 py-2 text-[12.5px] font-semibold transition-all duration-300 " +
                (c.slug === cat.slug
                  ? "border-primary/40 bg-primary text-primary-foreground"
                  : "border-primary/15 bg-white text-foreground/80 hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary")
              }
            >
              {c.name}
            </Link>
          ))}
      </div>


      {total === 0 ? (
        <div className="mt-12 rounded-3xl border border-dashed border-primary/25 bg-gradient-to-br from-white via-surface/50 to-surface px-6 py-16 text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">Coming soon</div>
          <h2 className="text-display mt-3 text-2xl sm:text-3xl">
            {cat.slug === "decorative-lights"
              ? "Decorative lighting collection coming soon."
              : `${cat.name} collection coming soon.`}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            {cat.slug === "decorative-lights"
              ? "Our festive and Diwali decorative range is being finalised. Explore our interior and concealed lighting in the meantime."
              : "This collection is being prepared. Browse our other categories in the meantime."}
          </p>
          <Link
            to="/products"
            className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Browse all products
          </Link>
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
