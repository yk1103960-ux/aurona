import { createFileRoute, Link, notFound, redirect, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Heart, Minus, Plus, ShoppingCart, Star, Truck, Shield, PackageCheck, ArrowRight, MessageCircle, Repeat2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { productQuery, productsQuery, categoriesQuery, familyQuery, familyProductsQuery } from "@/lib/queries";
import { productImagesQuery } from "@/lib/product-images";
import { supabase } from "@/integrations/supabase/client";
import { discountPct, inr } from "@/lib/format";
import { ProductImage } from "@/components/product/ProductImage";
import { ProductGallery } from "@/components/product/ProductGallery";
import { PDPSkeleton } from "@/components/product/PDPSkeleton";
import { ProductCard } from "@/components/product/ProductCard";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { useVariantSelection } from "@/hooks/useVariantSelection";
import { cn } from "@/lib/utils";
import type { ProductFamily } from "@/lib/queries";

export const Route = createFileRoute("/products/$slug")({
  loader: async ({ context, params }) => {
    // Kick off family + related in parallel; only await the family for the redirect check
    const famPromise = context.queryClient.ensureQueryData(familyQuery(params.slug));
    context.queryClient.ensureQueryData(categoriesQuery);
    context.queryClient.ensureQueryData(productsQuery({ featured: true, limit: 4 }));
    const fam = await famPromise;
    if (fam) {
      context.queryClient.ensureQueryData(productImagesQuery({ familyId: fam.id }));
      return;
    }
    const p = await context.queryClient.ensureQueryData(productQuery(params.slug));
    if (!p) throw notFound();
    const { data: v } = await supabase
      .from("product_variants")
      .select("family_id, product_families!inner(slug)")
      .eq("sku", p.sku)
      .maybeSingle();
    const familySlug = (v as { product_families?: { slug: string } } | null)?.product_families?.slug;
    if (familySlug && familySlug !== params.slug) {
      throw redirect({ to: "/products/$slug", params: { slug: familySlug }, search: { v: p.sku } });
    }
    context.queryClient.ensureQueryData(productImagesQuery({ productId: p.id }));
  },
  validateSearch: (s: Record<string, unknown>) => ({ v: typeof s.v === "string" ? s.v : undefined }),
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — Aurona` },
      { name: "description", content: `Buy ${params.slug.replace(/-/g, " ")} at Aurona — manufacturer-direct pricing with warranty and PAN India shipping.` },
    ],
  }),
  pendingComponent: PDPSkeleton,
  pendingMs: 100,
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
  const { v } = Route.useSearch();
  const fam = useSuspenseQuery(familyQuery(slug)).data;
  if (fam) return <FamilyPDP family={fam} initialSku={v} />;
  return <LegacyPDP slug={slug} />;
}

function FamilyPDP({ family, initialSku }: { family: ProductFamily; initialSku?: string }) {
  const cats = useSuspenseQuery(categoriesQuery).data;
  const featured = useSuspenseQuery(productsQuery({ featured: true, limit: 4 })).data;
  const cat = cats.find((c) => c.id === family.category_id);
  const { selection, setAxis, variant, isAvailable } = useVariantSelection(family, initialSku);
  const [qty, setQty] = useState(1);
  const cart = useCart();
  const wl = useWishlist();
  const nav = useNavigate();
  const productId = variant.product_id ?? null;

  const off = discountPct(variant.mrp, variant.price);
  const inStock = variant.stock > 0;
  const packSize = variant.pack_size ?? variant.moq ?? 1;
  const discountAmount = Math.max(0, Number(variant.mrp) - Number(variant.price));
  const pricePerPack = Number(variant.price) * packSize;
  const totalOrderValue = pricePerPack * qty;
  const totalSaved = discountAmount * packSize * qty;

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
        <FamilyGallery family={family} variantSku={variant.sku} variantImageSeed={variant.image_seed} categoryIcon={cat?.icon} />

        <div>
          <div className="text-eyebrow">{cat?.name ?? "Aurona"}</div>
          <h1 className="text-display mt-2 text-4xl">{family.name}</h1>
          <div className="mt-2 text-sm text-muted-foreground">Brand: {family.brand} · Model: {family.main_sku}</div>

          <div className="mt-5 overflow-hidden rounded-lg border border-border bg-surface">
            <div className="flex items-center justify-between gap-4 bg-primary px-4 py-3 text-primary-foreground">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider">Starting price</div>
                <div className="text-[11px] opacity-80">Base price for this selected product model</div>
              </div>
              <div className="text-right">
                <div className="text-display text-2xl">{inr(variant.price)}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">per {productId ? "unit" : "sku"}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className={cn("h-3.5 w-3.5", i < Math.round(Number(family.rating)) ? "fill-gold text-gold" : "text-border")} />
                ))}
                <span className="ml-1">({family.review_count} reviews)</span>
              </div>
              <span className={cn("font-semibold", inStock ? "text-success" : "text-destructive")}>{inStock ? `${variant.stock} available` : "Out of stock"}</span>
              <button className="inline-flex items-center gap-1 hover:text-foreground">
                <MessageCircle className="h-3.5 w-3.5" /> Product enquiry
              </button>
              <button onClick={() => productId && wl.toggle.mutate(productId)} className="inline-flex items-center gap-1 hover:text-foreground">
                <Heart className={cn("h-3.5 w-3.5", productId && wl.has(productId) && "fill-current text-destructive")} /> Wishlist
              </button>
              <button className="inline-flex items-center gap-1 hover:text-foreground">
                <Repeat2 className="h-3.5 w-3.5" /> Compare
              </button>
            </div>
          </div>

          {family.short_description && (
            <p className="mt-6 text-sm text-muted-foreground">{family.short_description}</p>
          )}

          {/* Axis pickers */}
          {family.axes.length > 0 && (
            <div className="mt-8 space-y-4 border-t border-border pt-6">
              <div className="text-eyebrow text-foreground">Select variants</div>
              {family.axes.map((axis) => (
                <div key={axis.axis_key} className="grid gap-2 sm:grid-cols-[140px_1fr] sm:items-start">
                  <div className="pt-2 text-xs text-muted-foreground">
                    {axis.label}
                    <span className="ml-1 text-foreground">{selection[axis.axis_key]}</span>
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
                            "min-h-9 rounded-none border px-4 py-2 text-xs font-medium transition",
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

          <div className="mt-5 grid gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
            <div className="text-xs text-muted-foreground">Quantity of packs</div>
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-border">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="grid h-10 w-10 place-items-center hover:bg-surface">
                  <Minus className="h-4 w-4" />
                </button>
                <div className="w-12 text-center text-sm font-semibold">{qty}</div>
                <button onClick={() => setQty(qty + 1)} className="grid h-10 w-10 place-items-center hover:bg-surface">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <span className="text-xs text-muted-foreground">Pack of {packSize}</span>
            </div>
          </div>

          <div className="mt-7 divide-y divide-border border-y border-border">
            <PriceRow label="M.R.P." value={`${inr(variant.mrp)} /Pc`} muted />
            <PriceRow label="Discount %" value={`${off}%`} highlight />
            <PriceRow label="Discount amount" value={`${inr(discountAmount)} /Pc`} highlight />
            <PriceRow label="Price per unit" value={`${inr(variant.price)} /Pc`} />
            <PriceRow label="Price per pack" value={`${inr(pricePerPack)} /Pack`} />
            <PriceRow label="Total order value" value={inr(totalOrderValue)} />
            <PriceRow label="You save on this order" value={inr(totalSaved)} highlight />
            <PriceRow label="SKU" value={variant.sku} mono />
          </div>

          <div className="mt-8 grid gap-3 border border-border p-4 sm:grid-cols-2">
            <Spec label="MOQ" value={String(variant.moq)} />
            <Spec label="Weight" value={variant.weight_g ? `${variant.weight_g} g` : null} />
            <Spec label="Pack size" value={variant.pack_size ? String(variant.pack_size) : null} />
            <Spec label="Dimensions (LxWxH)" value={variant.dim_l ? `${variant.dim_l} × ${variant.dim_w} × ${variant.dim_h} cm` : null} />
            <Spec label="Warranty" value={family.warranty} />
            <Spec label="Country of origin" value="India" />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button
              size="lg"
              variant="outline"
              className="h-12 gap-2 rounded-none"
              onClick={() => productId && cart.add.mutate({ productId, quantity: qty })}
              disabled={!productId || !inStock || cart.add.isPending}
            >
              <ShoppingCart className="h-4 w-4" /> Add to cart
            </Button>
            <Button size="lg" className="h-12 rounded-none" onClick={buyNow} disabled={!productId || !inStock}>
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
        <LegacyGallery product={product} categoryIcon={cat?.icon} />
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

function PriceRow({
  label,
  value,
  muted,
  highlight,
  mono,
}: {
  label: string;
  value: string;
  muted?: boolean;
  highlight?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(118px,0.8fr)_1.2fr] gap-4 px-4 py-3 text-sm sm:grid-cols-[150px_1fr]">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={cn(
          "font-semibold text-foreground",
          muted && "text-muted-foreground line-through",
          highlight && "text-success",
          mono && "font-mono text-xs font-medium",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function FamilyGallery({ family, variantSku, variantImageSeed, categoryIcon }: {
  family: ProductFamily; variantSku: string; variantImageSeed: string | null; categoryIcon?: string | null;
}) {
  const { data: all = [] } = useQuery(productImagesQuery({ familyId: family.id }));
  const filtered = all.filter((i) => !i.variant_sku || i.variant_sku === variantSku);
  const images = filtered.length ? filtered : all;
  return (
    <ProductGallery
      images={images}
      fallback={{ image_seed: variantImageSeed ?? family.image_seed, name: family.name, slug: family.slug }}
      categoryIcon={categoryIcon}
    />
  );
}

function LegacyGallery({ product, categoryIcon }: {
  product: { id: string; name: string; slug: string; image_seed: string | null };
  categoryIcon?: string | null;
}) {
  const { data: images = [] } = useQuery(productImagesQuery({ productId: product.id }));
  return (
    <ProductGallery
      images={images}
      fallback={{ image_seed: product.image_seed, name: product.name, slug: product.slug }}
      categoryIcon={categoryIcon}
    />
  );
}
