import { createFileRoute, Link, notFound, redirect, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Heart, Minus, Plus, ShoppingCart, Star, Truck, Shield, PackageCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { productQuery, productsQuery, categoriesQuery, familyQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { discountPct, inr } from "@/lib/format";
import { ProductImage } from "@/components/product/ProductImage";
import { ProductCard } from "@/components/product/ProductCard";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { useVariantSelection } from "@/hooks/useVariantSelection";
import { cn } from "@/lib/utils";
import type { ProductFamily } from "@/lib/queries";

export const Route = createFileRoute("/products/$slug")({
  loader: async ({ context, params }) => {
    // Try family first
    const fam = await context.queryClient.ensureQueryData(familyQuery(params.slug));
    if (!fam) {
      const p = await context.queryClient.ensureQueryData(productQuery(params.slug));
      if (!p) throw notFound();
      // If this product's SKU belongs to a family, redirect to family PDP with SKU hint
      const { data: v } = await supabase
        .from("product_variants")
        .select("family_id, product_families!inner(slug)")
        .eq("sku", p.sku)
        .maybeSingle();
      const familySlug = (v as { product_families?: { slug: string } } | null)?.product_families?.slug;
      if (familySlug && familySlug !== params.slug) {
        throw redirect({ to: "/products/$slug", params: { slug: familySlug }, search: { v: p.sku } });
      }
    }
    context.queryClient.ensureQueryData(categoriesQuery);
    context.queryClient.ensureQueryData(productsQuery({ featured: true, limit: 4 }));
  },
  validateSearch: (s: Record<string, unknown>) => ({ v: typeof s.v === "string" ? s.v : undefined }),
  head: ({ params }) => ({
    meta: [{ title: `${params.slug.replace(/-/g, " ")} — Aurona` }],
  }),
  component: PDPRoute,
  notFoundComponent: () => (
    <div className="container-x py-24 text-center">
      <h1 className="text-display text-3xl">Product not found</h1>
      <Button asChild className="mt-6"><Link to="/products">Browse all products</Link></Button>
    </div>
  ),
});

function PDPRoute() {
  const { slug } = Route.useParams();
  const fam = useSuspenseQuery(familyQuery(slug)).data;
  if (fam) return <FamilyPDP family={fam} />;
  return <LegacyPDP slug={slug} />;
}

function FamilyPDP({ family }: { family: ProductFamily }) {
  const cats = useSuspenseQuery(categoriesQuery).data;
  const featured = useSuspenseQuery(productsQuery({ featured: true, limit: 4 })).data;
  const cat = cats.find((c) => c.id === family.category_id);
  const { selection, setAxis, variant, isAvailable } = useVariantSelection(family);
  const [qty, setQty] = useState(1);
  const cart = useCart();
  const wl = useWishlist();
  const nav = useNavigate();

  // Resolve variant → matching legacy `products.id` (cart uses product_id)
  const { data: productId } = useQuery({
    queryKey: ["variant-product-id", variant?.sku],
    enabled: !!variant?.sku,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id").eq("sku", variant!.sku).maybeSingle();
      return data?.id ?? null;
    },
  });

  const off = discountPct(variant.mrp, variant.price);
  const inStock = variant.stock > 0;

  const buyNow = async () => {
    if (!productId) return;
    await cart.add.mutateAsync({ productId, quantity: qty });
    nav({ to: "/checkout" });
  };

  return (
    <div className="container-x py-8">
      <div className="mb-6 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link> /{" "}
        <Link to="/products" className="hover:text-foreground">Products</Link>
        {cat && <> / <Link to="/category/$slug" params={{ slug: cat.slug }} className="hover:text-foreground">{cat.name}</Link></>}
        <> / <span className="text-foreground">{family.name}</span></>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <ProductImage
            product={{ image_seed: variant.image_seed ?? family.image_seed, name: family.name, slug: family.slug }}
            categoryIcon={cat?.icon}
            className="aspect-square w-full"
            iconClassName="h-40 w-40"
          />
          <div className="mt-3 grid grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <ProductImage
                key={i}
                product={{ image_seed: family.image_seed, name: family.name, slug: family.slug }}
                categoryIcon={cat?.icon}
                className={cn("aspect-square", i === 0 && "ring-2 ring-gold")}
                iconClassName="h-8 w-8"
              />
            ))}
          </div>
        </div>

        <div>
          <div className="text-eyebrow">{cat?.name ?? "Aurona"}</div>
          <h1 className="text-display mt-2 text-4xl">{family.name}</h1>
          <div className="mt-2 text-sm text-muted-foreground">
            SKU: {variant.sku} · Brand: {family.brand} · Main: {family.main_sku}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs">
              <Star className="h-3.5 w-3.5 fill-gold text-gold" />
              <span className="font-semibold">{Number(family.rating).toFixed(1)}</span>
            </div>
            <span className="text-xs text-muted-foreground">{family.review_count} reviews</span>
            <span className={cn("text-xs font-semibold", inStock ? "text-success" : "text-destructive")}>
              {inStock ? "In stock" : "Out of stock"}
            </span>
          </div>

          <div className="mt-6 flex items-baseline gap-3">
            <span className="text-display text-4xl">{inr(variant.price)}</span>
            {Number(variant.mrp) > Number(variant.price) && (
              <>
                <span className="text-lg text-muted-foreground line-through">{inr(variant.mrp)}</span>
                <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">{off}% OFF</span>
              </>
            )}
            <span className="ml-auto text-sm text-muted-foreground">/ piece</span>
          </div>

          {family.short_description && (
            <p className="mt-6 text-sm text-muted-foreground">{family.short_description}</p>
          )}

          {/* Axis pickers */}
          {family.axes.length > 0 && (
            <div className="mt-8 space-y-5">
              {family.axes.map((axis) => (
                <div key={axis.axis_key}>
                  <div className="mb-2 flex items-center gap-2 text-xs">
                    <span className="text-eyebrow">{axis.label}</span>
                    <span className="font-medium text-foreground">{selection[axis.axis_key]}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {axis.values.map((val) => {
                      const active = selection[axis.axis_key] === val;
                      const avail = isAvailable(axis.axis_key, val);
                      return (
                        <button
                          key={val}
                          onClick={() => setAxis(axis.axis_key, val)}
                          disabled={!avail}
                          className={cn(
                            "rounded-full border px-4 py-2 text-xs font-medium transition",
                            active
                              ? "border-foreground bg-foreground text-background"
                              : "border-border hover:border-foreground",
                            !avail && "cursor-not-allowed opacity-40 line-through",
                          )}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-2">
            <Spec label="MOQ" value={String(variant.moq)} />
            <Spec label="Weight" value={variant.weight_g ? `${variant.weight_g} g` : null} />
            <Spec label="Pack size" value={variant.pack_size ? String(variant.pack_size) : null} />
            <Spec
              label="Dimensions (LxWxH)"
              value={variant.dim_l ? `${variant.dim_l} × ${variant.dim_w} × ${variant.dim_h} cm` : null}
            />
            <Spec label="Warranty" value={family.warranty} />
            <Spec label="Country of origin" value="India" />
          </div>

          <div className="mt-8 flex items-center gap-4">
            <div className="flex items-center rounded-full border border-border">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="grid h-11 w-11 place-items-center">
                <Minus className="h-4 w-4" />
              </button>
              <div className="w-10 text-center text-sm font-semibold">{qty}</div>
              <button onClick={() => setQty(qty + 1)} className="grid h-11 w-11 place-items-center">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => productId && wl.toggle.mutate(productId)}
              className={cn(
                "grid h-11 w-11 place-items-center rounded-full border border-border hover:bg-surface",
                productId && wl.has(productId) && "text-destructive",
              )}
              aria-label="Wishlist"
            >
              <Heart className={cn("h-4 w-4", productId && wl.has(productId) && "fill-current")} />
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button
              size="lg"
              variant="outline"
              className="h-12 gap-2 rounded-full"
              onClick={() => productId && cart.add.mutate({ productId, quantity: qty })}
              disabled={!productId || !inStock || cart.add.isPending}
            >
              <ShoppingCart className="h-4 w-4" /> Add to cart
            </Button>
            <Button size="lg" className="h-12 rounded-full" onClick={buyNow} disabled={!productId || !inStock}>
              Buy now
            </Button>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
            <div className="flex flex-col items-center gap-1 rounded-xl border border-border p-3 text-center">
              <Truck className="h-4 w-4 text-gold" /> PAN India delivery
            </div>
            <div className="flex flex-col items-center gap-1 rounded-xl border border-border p-3 text-center">
              <Shield className="h-4 w-4 text-gold" /> {family.warranty ?? "1 Year"} warranty
            </div>
            <div className="flex flex-col items-center gap-1 rounded-xl border border-border p-3 text-center">
              <PackageCheck className="h-4 w-4 text-gold" /> Manufacturer direct
            </div>
          </div>
        </div>
      </div>

      <div className="mt-16">
        <Tabs defaultValue="desc">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
            <TabsTrigger value="desc">Description</TabsTrigger>
            <TabsTrigger value="specs">Specifications</TabsTrigger>
            <TabsTrigger value="variations">All Variations ({family.variants.length})</TabsTrigger>
            <TabsTrigger value="ship">Shipping</TabsTrigger>
          </TabsList>
          <TabsContent value="desc" className="prose max-w-3xl pt-6 text-sm text-muted-foreground">
            {family.description || family.short_description || `Premium ${family.name} by Aurona — engineered in India with a ${family.warranty ?? "1 Year"} manufacturer warranty.`}
          </TabsContent>
          <TabsContent value="specs" className="pt-6">
            <div className="max-w-2xl divide-y divide-border rounded-xl border border-border">
              {[
                ["Brand", family.brand],
                ["Category", cat?.name],
                ["Main SKU", family.main_sku],
                ["Selected SKU", variant.sku],
                ...Object.entries(variant.attributes).map(([k, v]) => [k.replace(/_/g, " "), v] as const),
                ["Warranty", family.warranty],
                ["Material", family.material],
                ["Country of origin", "India"],
              ].map(([k, v]) => (
                <div key={k as string} className="grid grid-cols-2 gap-4 px-4 py-3 text-sm">
                  <div className="capitalize text-muted-foreground">{k}</div>
                  <div className="font-medium">{v || "—"}</div>
                </div>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="variations" className="pt-6">
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">SKU</th>
                    {family.axes.map((a) => <th key={a.axis_key} className="px-3 py-2">{a.label}</th>)}
                    <th className="px-3 py-2 text-right">MRP</th>
                    <th className="px-3 py-2 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {family.variants.map((v) => (
                    <tr key={v.id} className={cn(v.sku === variant.sku && "bg-surface/60")}>
                      <td className="px-3 py-2 font-mono text-xs">{v.sku}</td>
                      {family.axes.map((a) => <td key={a.axis_key} className="px-3 py-2">{v.attributes[a.axis_key] ?? "—"}</td>)}
                      <td className="px-3 py-2 text-right text-muted-foreground line-through">{inr(v.mrp)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{inr(v.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
          <TabsContent value="ship" className="pt-6 text-sm text-muted-foreground">
            PAN India delivery in 3–7 business days. Free shipping on orders over ₹999.
          </TabsContent>
        </Tabs>
      </div>

      <div className="mt-20">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <div className="text-eyebrow">Also popular</div>
            <h2 className="text-display mt-2 text-3xl">You may also like</h2>
          </div>
          <Link to="/products" className="hidden items-center gap-1 text-sm font-medium hover:text-gold sm:inline-flex">
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {featured.slice(0, 4).map((p) => (
            <ProductCard key={p.id} product={p} categoryIcon={cats.find((c) => c.id === p.category_id)?.icon} />
          ))}
        </div>
      </div>
    </div>
  );
}

function LegacyPDP({ slug }: { slug: string }) {
  const product = useSuspenseQuery(productQuery(slug)).data!;
  const cats = useSuspenseQuery(categoriesQuery).data;
  const featured = useSuspenseQuery(productsQuery({ featured: true, limit: 4 })).data;
  const cat = cats.find((c) => c.id === product.category_id);
  const [qty, setQty] = useState(1);
  const cart = useCart();
  const wl = useWishlist();
  const nav = useNavigate();
  const off = discountPct(product.mrp, product.price);

  const buyNow = async () => {
    await cart.add.mutateAsync({ productId: product.id, quantity: qty });
    nav({ to: "/checkout" });
  };

  return (
    <div className="container-x py-8">
      <div className="mb-6 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link> /{" "}
        <Link to="/products" className="hover:text-foreground">Products</Link>
        {cat && <> / <Link to="/category/$slug" params={{ slug: cat.slug }} className="hover:text-foreground">{cat.name}</Link></>}
        <> / <span className="text-foreground">{product.name}</span></>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <ProductImage product={product} categoryIcon={cat?.icon} className="aspect-square w-full" iconClassName="h-40 w-40" />
        </div>
        <div>
          <div className="text-eyebrow">{cat?.name ?? "Aurona"}</div>
          <h1 className="text-display mt-2 text-4xl">{product.name}</h1>
          <div className="mt-2 text-sm text-muted-foreground">SKU: {product.sku} · Brand: {product.brand}</div>
          <div className="mt-6 flex items-baseline gap-3">
            <span className="text-display text-4xl">{inr(product.price)}</span>
            {Number(product.mrp) > Number(product.price) && (
              <>
                <span className="text-lg text-muted-foreground line-through">{inr(product.mrp)}</span>
                <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">{off}% OFF</span>
              </>
            )}
          </div>
          <div className="mt-8 flex items-center gap-4">
            <div className="flex items-center rounded-full border border-border">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="grid h-11 w-11 place-items-center"><Minus className="h-4 w-4" /></button>
              <div className="w-10 text-center text-sm font-semibold">{qty}</div>
              <button onClick={() => setQty(qty + 1)} className="grid h-11 w-11 place-items-center"><Plus className="h-4 w-4" /></button>
            </div>
            <button onClick={() => wl.toggle.mutate(product.id)} className={cn("grid h-11 w-11 place-items-center rounded-full border border-border hover:bg-surface", wl.has(product.id) && "text-destructive")}>
              <Heart className={cn("h-4 w-4", wl.has(product.id) && "fill-current")} />
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button size="lg" variant="outline" className="h-12 gap-2 rounded-full" onClick={() => cart.add.mutate({ productId: product.id, quantity: qty })}>
              <ShoppingCart className="h-4 w-4" /> Add to cart
            </Button>
            <Button size="lg" className="h-12 rounded-full" onClick={buyNow}>Buy now</Button>
          </div>
        </div>
      </div>

      <div className="mt-20">
        <h2 className="text-display text-3xl">You may also like</h2>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {featured.filter((p) => p.id !== product.id).slice(0, 4).map((p) => (
            <ProductCard key={p.id} product={p} categoryIcon={cats.find((c) => c.id === p.category_id)?.icon} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-eyebrow">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value || "—"}</div>
    </div>
  );
}
