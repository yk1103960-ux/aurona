import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
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
});

export const Route = createFileRoute("/products")({
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

  const filtered = useMemo(() => {
    let list = all;
    if (sp.group) list = list.filter((p) => cats.find((c) => c.id === p.category_id)?.parent_group === sp.group);
    if (sp.cat) list = list.filter((p) => cats.find((c) => c.id === p.category_id)?.slug === sp.cat);
    if (sp.q) list = list.filter((p) => p.name.toLowerCase().includes(sp.q.toLowerCase()));
    const sorted = [...list];
    if (sp.sort === "price-asc") sorted.sort((a, b) => Number(a.price) - Number(b.price));
    else if (sp.sort === "price-desc") sorted.sort((a, b) => Number(b.price) - Number(a.price));
    else if (sp.sort === "rating") sorted.sort((a, b) => Number(b.rating) - Number(a.rating));
    return sorted;
  }, [all, cats, sp]);

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
              onChange={(e) => nav({ search: (s) => ({ ...s, q: e.target.value }) })}
              placeholder="Search products…"
              className="h-10 pr-8"
            />
            {sp.q && (
              <button onClick={() => nav({ search: (s) => ({ ...s, q: "" }) })} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
          <select
            value={sp.sort}
            onChange={(e) => nav({ search: (s) => ({ ...s, sort: e.target.value }) })}
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
            <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto p-6">
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
          <div className="rounded-xl border border-dashed border-border py-24 text-center">
            <div className="text-display text-2xl">No products found</div>
            <p className="mt-2 text-sm text-muted-foreground">Try another keyword or category.</p>
            <Button onClick={() => nav({ search: { q: "", cat: "", group: "", sort: "newest" } })} className="mt-6">
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => <ProductCard key={p.id} product={p} categoryIcon={cats.find((c) => c.id === p.category_id)?.icon} />)}
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
          {cats.filter((c) => !sp.group || c.parent_group === sp.group).map((c) => (
            <button
              key={c.id}
              onClick={() => nav({ search: (s: any) => ({ ...s, cat: c.slug }) })}
              className={cn("block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface", sp.cat === c.slug && "font-semibold text-foreground")}
            >{c.name}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
