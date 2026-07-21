import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo, useState } from "react";
import { SearchX, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ProductCard } from "@/components/product/ProductCard";
import { categoriesQuery, productsQuery, type Product } from "@/lib/queries";
import { cn } from "@/lib/utils";

const search = z.object({
  q: fallback(z.string(), "").default(""),
  group: fallback(z.string(), "").default(""),
  cat: fallback(z.string(), "").default(""),
  sort: fallback(z.string(), "newest").default("newest"),
  min: fallback(z.number(), 0).default(0),
  max: fallback(z.number(), 0).default(0),
});


export const Route = createFileRoute("/products/")({
  validateSearch: zodValidator(search),
  head: () => ({
    meta: [
      { title: "All Products — Aurona" },
      { name: "description", content: "Browse Aurona's full catalog of LED lighting, fans, heaters and home appliances." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(categoriesQuery);
    context.queryClient.ensureQueryData(productsQuery({}));
  },
  component: ProductsPage,
});

function ProductsPage() {
  const sp = Route.useSearch();
  const nav = Route.useNavigate();
  const cats = useSuspenseQuery(categoriesQuery).data;
  const all = useSuspenseQuery(productsQuery({})).data as (Product & { categories: any })[];
  const [visible, setVisible] = useState(48);

  const filtered = useMemo(() => {
    let list = all;
    if (sp.group) list = list.filter((p) => cats.find((c) => c.id === p.category_id)?.parent_group === sp.group);
    if (sp.cat) list = list.filter((p) => cats.find((c) => c.id === p.category_id)?.slug === sp.cat);
    if (sp.q) list = list.filter((p) => p.name.toLowerCase().includes(sp.q.toLowerCase()));
    if (sp.min > 0) list = list.filter((p) => Number(p.price) >= sp.min);
    if (sp.max > 0) list = list.filter((p) => Number(p.price) <= sp.max);
    const sorted = [...list];
    if (sp.sort === "price-asc") sorted.sort((a, b) => Number(a.price) - Number(b.price));
    else if (sp.sort === "price-desc") sorted.sort((a, b) => Number(b.price) - Number(a.price));
    else if (sp.sort === "rating") sorted.sort((a, b) => Number(b.rating) - Number(a.rating));
    return sorted;
  }, [all, cats, sp]);

  const shown = filtered.slice(0, visible);



  const groupLabel: Record<string, string> = {
    "led-lighting": "LED Lighting",
    fans: "Fans",
    "home-appliances": "Home Appliances",
  };

  return (
    <div className="container-x py-8">
      {/* Breadcrumb */}
      <div className="mb-6 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link> / <span className="text-foreground">Products</span>
        {sp.group && <> / <span className="text-foreground">{groupLabel[sp.group] ?? sp.group}</span></>}
      </div>

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display text-3xl sm:text-4xl">
            {sp.cat ? cats.find((c) => c.slug === sp.cat)?.name : (sp.group ? groupLabel[sp.group] : "All Products")}
          </h1>
          <div className="mt-1 text-sm text-muted-foreground">{filtered.length} products</div>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Input
              value={sp.q}
              onChange={(e) => nav({ search: (s: typeof sp) => ({ ...s, q: e.target.value }) })}
              placeholder="Search products…"
              className="h-10 pr-8"
            />
            {sp.q && (
              <button onClick={() => nav({ search: (s: typeof sp) => ({ ...s, q: "" }) })} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
          <select
            value={sp.sort}
            onChange={(e) => nav({ search: (s: typeof sp) => ({ ...s, sort: e.target.value }) })}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="newest">Newest</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="rating">Highest Rated</option>
          </select>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 gap-2 lg:hidden">
                <SlidersHorizontal className="h-4 w-4" /> Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto p-6 pt-14">
              <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-display text-xl">Filters</h2>
                <button
                  onClick={() => nav({ search: { q: "", cat: "", group: "", sort: "newest", min: 0, max: 0 } })}
                  className="text-xs font-semibold uppercase tracking-wider text-primary hover:text-gold"
                >
                  Clear all
                </button>
              </div>
              <Filters cats={cats} sp={sp} nav={nav} />
            </SheetContent>

          </Sheet>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <Filters cats={cats} sp={sp} nav={nav} />
        </aside>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface py-20 text-center">
            <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full border border-border bg-background shadow-soft">
              <SearchX className="h-7 w-7 text-primary" strokeWidth={1.4} />
            </div>
            <div className="text-display text-3xl">No products found</div>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Try a different search term, or explore our collections — 150+ Aurona products across lighting, fans and appliances.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="press h-12 rounded-full px-8">
                <Link to="/">Browse categories</Link>
              </Button>
              <Button size="lg" variant="outline" className="press h-12 rounded-full px-8" onClick={() => nav({ search: { q: "", cat: "", group: "", sort: "newest", min: 0, max: 0 } })}>
                Clear filters
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
              {shown.map((p) => <ProductCard key={p.id} product={p} categoryIcon={cats.find((c) => c.id === p.category_id)?.icon} />)}
            </div>
            {visible < filtered.length && (
              <div className="mt-10 flex justify-center">
                <Button size="lg" variant="outline" className="press h-12 rounded-full px-8" onClick={() => setVisible((v) => v + 48)}>
                  Load more ({filtered.length - visible} remaining)
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}



function Filters({ cats, sp, nav }: { cats: any[]; sp: any; nav: any }) {
  const groups = ["led-lighting", "fans", "home-appliances"];
  const groupLabel: Record<string, string> = {
    "led-lighting": "LED Lighting", fans: "Fans", "home-appliances": "Home Appliances",
  };
  return (
    <div className="space-y-6">
      <div>
        <div className="text-eyebrow mb-3">Group</div>
        <div className="space-y-1">
          <button
            onClick={() => nav({ search: (s: any) => ({ ...s, group: "", cat: "" }) })}
            className={cn("block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface", !sp.group && "font-semibold text-foreground")}
          >All</button>
          {groups.map((g) => (
            <button
              key={g}
              onClick={() => nav({ search: (s: any) => ({ ...s, group: g, cat: "" }) })}
              className={cn("block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface", sp.group === g && "font-semibold text-foreground")}
            >{groupLabel[g]}</button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-eyebrow mb-3">Categories</div>
        <div className="space-y-1">
          <button
            onClick={() => nav({ search: (s: any) => ({ ...s, cat: "" }) })}
            className={cn("block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface", !sp.cat && "font-semibold text-foreground")}
          >All Categories</button>
          {cats.filter((c) => !sp.group || c.parent_group === sp.group).map((c) => (
            <button
              key={c.id}
              onClick={() => nav({ search: (s: any) => ({ ...s, cat: c.slug }) })}
              className={cn("block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface", sp.cat === c.slug && "font-semibold text-foreground")}
            >{c.name}</button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-eyebrow mb-3">Price Range (₹)</div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            placeholder="Min"
            value={sp.min || ""}
            onChange={(e) => nav({ search: (s: any) => ({ ...s, min: Number(e.target.value) || 0 }) })}
            className="h-10"
          />
          <span className="text-muted-foreground">—</span>
          <Input
            type="number"
            min={0}
            placeholder="Max"
            value={sp.max || ""}
            onChange={(e) => nav({ search: (s: any) => ({ ...s, max: Number(e.target.value) || 0 }) })}
            className="h-10"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[[0, 1000], [1000, 3000], [3000, 7000], [7000, 0]].map(([lo, hi]) => (
            <button
              key={`${lo}-${hi}`}
              onClick={() => nav({ search: (s: any) => ({ ...s, min: lo, max: hi }) })}
              className={cn(
                "rounded-full border border-border px-3 py-1 text-xs hover:border-primary",
                sp.min === lo && sp.max === hi && "border-primary bg-primary text-primary-foreground",
              )}
            >
              {lo === 0 ? `Under ₹${hi}` : hi === 0 ? `₹${lo}+` : `₹${lo}–₹${hi}`}
            </button>
          ))}
        </div>
      </div>
      <button
        onClick={() => nav({ search: { q: "", cat: "", group: "", sort: "newest", min: 0, max: 0 } })}
        className="hidden w-full rounded-md border border-border py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:border-primary hover:text-primary lg:block"
      >
        Clear all filters
      </button>
    </div>
  );

}
