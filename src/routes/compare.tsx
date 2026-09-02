import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { X, Trash2, GitCompare, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useCompare } from "@/hooks/useCompare";
import { useCart } from "@/hooks/useCart";
import { useVisiblePrices } from "@/lib/pricing";
import { inr } from "@/lib/format";
import { ProductImage } from "@/components/product/ProductImage";
import type { Product } from "@/lib/queries";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Compare Aurona lighting & appliances side by side" },
      { name: "description", content: "Compare up to three Aurona products on wattage, size, colour temperature, material, warranty and price before you buy." },
      { property: "og:title", content: "Compare Aurona products" },
      { property: "og:description", content: "Side-by-side specification comparison of Aurona lights, fans and appliances." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ComparePage,
});

const SPECS: { key: string; label: string }[] = [
  { key: "brand", label: "Brand" },
  { key: "sku", label: "SKU" },
  { key: "model", label: "Model" },
  { key: "wattage", label: "Wattage" },
  { key: "size", label: "Size" },
  { key: "color_temp", label: "Colour temperature" },
  { key: "body_type", label: "Body type" },
  { key: "material", label: "Material" },
  { key: "pack_size", label: "Pack size" },
  { key: "weight_g", label: "Weight (g)" },
  { key: "warranty", label: "Warranty" },
  { key: "unit", label: "Unit" },
  { key: "rating", label: "Rating" },
  { key: "stock", label: "Availability" },
];

function ComparePage() {
  const { slugs, remove, clear, max } = useCompare();
  const cart = useCart();

  const q = useQuery({
    queryKey: ["compare", [...slugs].sort().join(",")],
    enabled: slugs.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(slug, name, icon)")
        .in("slug", slugs);
      if (error) throw error;
      return (data ?? []) as unknown as (Product & { categories: { slug: string; name: string } | null })[];
    },
  });

  const rows = (q.data ?? []).slice().sort((a, b) => slugs.indexOf(a.slug) - slugs.indexOf(b.slug));
  const { data: priceMap } = useVisiblePrices(rows.map((r) => r.sku).filter(Boolean));

  return (
    <div className="container-x py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-eyebrow">Compare</div>
          <h1 className="text-display text-2xl sm:text-3xl">Compare products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Up to {max} products, side by side, using live specifications.
          </p>
        </div>
        {rows.length > 0 && (
          <Button variant="outline" className="rounded-full" onClick={clear}>
            <Trash2 className="mr-2 h-4 w-4" /> Clear all
          </Button>
        )}
      </div>

      {slugs.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-border bg-card p-10 text-center">
          <GitCompare className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-semibold">Nothing to compare yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap the compare icon on any product to add it here.
          </p>
          <Button asChild className="mt-5 rounded-full">
            <Link to="/products">Browse products</Link>
          </Button>
        </div>
      ) : q.isLoading ? (
        <div className="mt-8 text-sm text-muted-foreground">Loading specifications…</div>
      ) : q.isError ? (
        <div className="mt-8 text-sm text-destructive">Could not load these products. Please try again.</div>
      ) : (
        <div className="mt-6 w-full overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-28 border-b border-border p-2 text-left align-bottom text-xs uppercase tracking-wider text-muted-foreground sm:w-40">
                  Product
                </th>
                {rows.map((p) => {
                  const rp = priceMap?.[p.sku];
                  const price = rp?.price ?? Number(p.price);
                  return (
                    <th key={p.id} className="min-w-[150px] border-b border-border p-2 text-left align-top">
                      <div className="relative rounded-xl border border-border bg-card p-2">
                        <button
                          type="button"
                          aria-label={`Remove ${p.name} from compare`}
                          onClick={() => remove(p.slug)}
                          className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-muted-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <Link to="/products/$slug" params={{ slug: p.slug }} className="block">
                          <ProductImage product={p as never} className="aspect-square w-full rounded-lg" />
                          <div className="mt-2 line-clamp-2 text-xs font-semibold leading-tight">{p.name}</div>
                        </Link>
                        <div className="mt-1 text-sm font-bold text-primary">
                          {price > 0 ? inr(price) : "Price on request"}
                        </div>
                        <Button
                          size="sm"
                          className="mt-2 h-8 w-full rounded-full text-xs"
                          onClick={() => cart.add.mutate({ productId: p.id, sku: p.sku })}
                        >
                          <ShoppingCart className="mr-1 h-3 w-3" /> Add
                        </Button>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {SPECS.map((s) => (
                <tr key={String(s.key)} className="odd:bg-muted/30">
                  <td className="border-b border-border p-2 text-xs font-semibold text-muted-foreground">{s.label}</td>
                  {rows.map((p) => {
                    const raw = (p as unknown as Record<string, unknown>)[s.key];
                    const text =
                      s.key === "stock"
                        ? Number(raw) > 0 ? "In stock" : "Out of stock"
                        : raw === null || raw === undefined || raw === ""
                          ? "—"
                          : String(raw);
                    return (
                      <td key={p.id} className="border-b border-border p-2 align-top text-xs">
                        {text}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td className="p-2 text-xs font-semibold text-muted-foreground">Description</td>
                {rows.map((p) => (
                  <td key={p.id} className="p-2 align-top text-xs text-muted-foreground">
                    {p.short_description || p.description || "—"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
