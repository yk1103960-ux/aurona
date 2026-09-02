import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { X, Trash2, GitCompare, ShoppingCart, CheckCircle2, XCircle, Star } from "lucide-react";
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
      {
        name: "description",
        content:
          "Compare up to three Aurona products on wattage, size, colour temperature, material, warranty and price before you buy.",
      },
      { property: "og:title", content: "Compare Aurona products" },
      {
        property: "og:description",
        content: "Side-by-side specification comparison of Aurona lights, fans and appliances.",
      },
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
  { key: "weight_g", label: "Weight" },
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

      return (data ?? []) as unknown as (Product & {
        categories: {
          slug: string;
          name: string;
        } | null;
      })[];
    },
  });

  const rows = (q.data ?? []).slice().sort((a, b) => slugs.indexOf(a.slug) - slugs.indexOf(b.slug));

  const { data: priceMap } = useVisiblePrices(rows.map((r) => r.sku).filter(Boolean));

  const getSpecText = (p: Product, key: string) => {
    const raw = (p as unknown as Record<string, unknown>)[key];

    if (key === "stock") {
      return Number(raw) > 0 ? "In stock" : "Out of stock";
    }

    if (key === "rating") {
      const rating = Number(raw);
      return rating > 0 ? rating.toFixed(1) : "—";
    }

    if (key === "weight_g") {
      return raw ? `${raw} g` : "—";
    }

    if (raw === null || raw === undefined || raw === "") {
      return "—";
    }

    return String(raw);
  };

  return (
    <div className="container-x py-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-eyebrow">Compare products</div>

          <h1 className="mt-1 text-display text-3xl sm:text-4xl">Compare before you buy</h1>

          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Compare price, specifications, warranty and availability of up to {max} products side by side.
          </p>
        </div>

        {rows.length > 0 && (
          <Button variant="outline" className="rounded-full" onClick={clear}>
            <Trash2 className="mr-2 h-4 w-4" />
            Clear all
          </Button>
        )}
      </div>

      {slugs.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-border bg-card p-10 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <GitCompare className="h-7 w-7 text-primary" />
          </div>

          <h2 className="mt-4 text-xl font-semibold">Nothing to compare yet</h2>

          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Add products using the compare icon and they will appear here.
          </p>

          <Button asChild className="mt-5 rounded-full px-6">
            <Link to="/products">Browse products</Link>
          </Button>
        </div>
      ) : q.isLoading ? (
        <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Loading comparison…
        </div>
      ) : q.isError ? (
        <div className="mt-8 rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">
          Could not load these products. Please try again.
        </div>
      ) : (
        <div className="mt-7 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead className="bg-background">
                <tr>
                  <th className="sticky left-0 z-20 w-[180px] min-w-[180px] border-b border-r border-border bg-background p-4 text-left align-bottom">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Product
                    </span>
                  </th>

                  {rows.map((p) => {
                    const rp = priceMap?.[p.sku];
                    const price = rp?.price ?? Number(p.price);
                    const stock = Number((p as unknown as Record<string, unknown>).stock);
                    const rating = Number((p as unknown as Record<string, unknown>).rating);

                    return (
                      <th
                        key={p.id}
                        className="min-w-[250px] border-b border-r border-border p-4 text-left align-top last:border-r-0"
                      >
                        <div className="relative">
                          <button
                            type="button"
                            aria-label={`Remove ${p.name} from compare`}
                            onClick={() => remove(p.slug)}
                            className="absolute right-0 top-0 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </button>

                          <Link to="/products/$slug" params={{ slug: p.slug }} className="block pr-10">
                            <div className="overflow-hidden rounded-2xl border border-border bg-muted/20">
                              <ProductImage product={p as never} className="aspect-square w-full object-contain" />
                            </div>

                            <div className="mt-3 line-clamp-2 text-base font-semibold leading-snug text-foreground">
                              {p.name}
                            </div>
                          </Link>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="text-xl font-bold text-primary">
                              {price > 0 ? inr(price) : "Price on request"}
                            </span>
                          </div>

                          {rating > 0 && (
                            <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                              <Star className="h-4 w-4 fill-current text-yellow-500" />
                              <span className="font-semibold text-foreground">{rating.toFixed(1)}</span>
                              <span>rating</span>
                            </div>
                          )}

                          <div className="mt-2">
                            {stock > 0 ? (
                              <div className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                                <CheckCircle2 className="h-4 w-4" />
                                In stock
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                                <XCircle className="h-4 w-4" />
                                Out of stock
                              </div>
                            )}
                          </div>

                          <Button
                            size="sm"
                            className="mt-4 h-10 w-full rounded-full"
                            disabled={stock <= 0}
                            onClick={() =>
                              cart.add.mutate({
                                productId: p.id,
                                sku: p.sku,
                              })
                            }
                          >
                            <ShoppingCart className="mr-2 h-4 w-4" />
                            Add to cart
                          </Button>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td
                    colSpan={rows.length + 1}
                    className="border-b border-border bg-muted/40 px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    Product specifications
                  </td>
                </tr>

                {SPECS.map((spec, index) => (
                  <tr key={spec.key} className={index % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                    <td className="sticky left-0 z-10 border-b border-r border-border bg-inherit p-4 text-sm font-semibold text-foreground">
                      {spec.label}
                    </td>

                    {rows.map((p) => {
                      const text = getSpecText(p, spec.key);

                      return (
                        <td
                          key={`${p.id}-${spec.key}`}
                          className="border-b border-r border-border p-4 align-top text-sm last:border-r-0"
                        >
                          {spec.key === "stock" ? (
                            text === "In stock" ? (
                              <span className="inline-flex items-center gap-1.5 font-medium text-green-600">
                                <CheckCircle2 className="h-4 w-4" />
                                In stock
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 font-medium text-destructive">
                                <XCircle className="h-4 w-4" />
                                Out of stock
                              </span>
                            )
                          ) : spec.key === "rating" && text !== "—" ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Star className="h-4 w-4 fill-current text-yellow-500" />
                              <span className="font-semibold">{text}</span>
                            </span>
                          ) : (
                            <span className={text === "—" ? "text-muted-foreground" : "text-foreground"}>{text}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                <tr>
                  <td className="sticky left-0 z-10 border-r border-border bg-background p-4 align-top text-sm font-semibold">
                    Description
                  </td>

                  {rows.map((p) => (
                    <td
                      key={p.id}
                      className="border-r border-border p-4 align-top text-sm leading-relaxed text-muted-foreground last:border-r-0"
                    >
                      {p.short_description || p.description || "—"}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
