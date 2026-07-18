import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Heart, Minus, Plus, ShoppingCart, Star, Truck, Shield, PackageCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { productQuery, productsQuery, categoriesQuery } from "@/lib/queries";
import { discountPct, inr } from "@/lib/format";
import { ProductImage } from "@/components/product/ProductImage";
import { ProductCard } from "@/components/product/ProductCard";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/products/$slug")({
  loader: async ({ context, params }) => {
    const p = await context.queryClient.ensureQueryData(productQuery(params.slug));
    if (!p) throw notFound();
    context.queryClient.ensureQueryData(categoriesQuery);
    context.queryClient.ensureQueryData(productsQuery({ featured: true, limit: 4 }));
  },
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — Aurona` },
    ],
  }),
  component: PDP,
  notFoundComponent: () => (
    <div className="container-x py-24 text-center">
      <h1 className="text-display text-3xl">Product not found</h1>
      <Button asChild className="mt-6"><Link to="/products">Browse all products</Link></Button>
    </div>
  ),
});

function PDP() {
  const { slug } = Route.useParams();
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
    <div>
      <div className="container-x py-8">
        <div className="mb-6 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Home</Link> /{" "}
          <Link to="/products" className="hover:text-foreground">Products</Link>
          {cat && <> / <Link to="/category/$slug" params={{ slug: cat.slug }} className="hover:text-foreground">{cat.name}</Link></>}
          <> / <span className="text-foreground">{product.name}</span></>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr]">
          {/* Gallery */}
          <div>
            <ProductImage
              product={product}
              categoryIcon={cat?.icon}
              className="aspect-square w-full"
              iconClassName="h-40 w-40"
            />
            <div className="mt-3 grid grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <ProductImage
                  key={i}
                  product={product}
                  categoryIcon={cat?.icon}
                  className={cn("aspect-square", i === 0 && "ring-2 ring-gold")}
                  iconClassName="h-8 w-8"
                />
              ))}
            </div>
          </div>

          {/* Info */}
          <div>
            <div className="text-eyebrow">{cat?.name ?? "Aurona"}</div>
            <h1 className="text-display mt-2 text-4xl">{product.name}</h1>
            <div className="mt-2 text-sm text-muted-foreground">SKU: {product.sku} · Brand: {product.brand}</div>

            <div className="mt-4 flex items-center gap-3">
              <div className="flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs">
                <Star className="h-3.5 w-3.5 fill-gold text-gold" />
                <span className="font-semibold">{Number(product.rating).toFixed(1)}</span>
              </div>
              <span className="text-xs text-muted-foreground">{product.review_count} reviews</span>
              <span className={cn("text-xs font-semibold", product.stock > 0 ? "text-success" : "text-destructive")}>
                {product.stock > 0 ? "In stock" : "Out of stock"}
              </span>
            </div>

            <div className="mt-6 flex items-baseline gap-3">
              <span className="text-display text-4xl">{inr(product.price)}</span>
              {Number(product.mrp) > Number(product.price) && (
                <>
                  <span className="text-lg text-muted-foreground line-through">{inr(product.mrp)}</span>
                  <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">{off}% OFF</span>
                </>
              )}
              <span className="ml-auto text-sm text-muted-foreground">/ {product.unit}</span>
            </div>

            {product.short_description && (
              <p className="mt-6 text-sm text-muted-foreground">{product.short_description}</p>
            )}

            <div className="mt-8 grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-2">
              <Spec label="Wattage" value={product.wattage} />
              <Spec label="Size" value={product.size} />
              <Spec label="Colour temp" value={product.color_temp} />
              <Spec label="Warranty" value={product.warranty} />
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
                onClick={() => wl.toggle.mutate(product.id)}
                className={cn("grid h-11 w-11 place-items-center rounded-full border border-border hover:bg-surface", wl.has(product.id) && "text-destructive")}
                aria-label="Wishlist"
              >
                <Heart className={cn("h-4 w-4", wl.has(product.id) && "fill-current")} />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Button
                size="lg"
                variant="outline"
                className="h-12 gap-2 rounded-full"
                onClick={() => cart.add.mutate({ productId: product.id, quantity: qty })}
                disabled={cart.add.isPending}
              >
                <ShoppingCart className="h-4 w-4" /> Add to cart
              </Button>
              <Button size="lg" className="h-12 rounded-full" onClick={buyNow}>Buy now</Button>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
              <div className="flex flex-col items-center gap-1 rounded-xl border border-border p-3 text-center">
                <Truck className="h-4 w-4 text-gold" /> PAN India delivery
              </div>
              <div className="flex flex-col items-center gap-1 rounded-xl border border-border p-3 text-center">
                <Shield className="h-4 w-4 text-gold" /> {product.warranty} warranty
              </div>
              <div className="flex flex-col items-center gap-1 rounded-xl border border-border p-3 text-center">
                <PackageCheck className="h-4 w-4 text-gold" /> Manufacturer direct
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-16">
          <Tabs defaultValue="desc">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
              <TabsTrigger value="desc">Description</TabsTrigger>
              <TabsTrigger value="specs">Specifications</TabsTrigger>
              <TabsTrigger value="warranty">Warranty</TabsTrigger>
              <TabsTrigger value="ship">Shipping</TabsTrigger>
            </TabsList>
            <TabsContent value="desc" className="prose max-w-3xl pt-6 text-sm text-muted-foreground">
              {product.description || product.short_description || "Premium engineering by Aurona."}
            </TabsContent>
            <TabsContent value="specs" className="pt-6">
              <div className="max-w-2xl divide-y divide-border rounded-xl border border-border">
                {[
                  ["Brand", product.brand],
                  ["Category", cat?.name],
                  ["Wattage", product.wattage],
                  ["Size", product.size],
                  ["Colour temperature", product.color_temp],
                  ["Material", product.material],
                  ["Warranty", product.warranty],
                  ["Country of origin", "India"],
                ].map(([k, v]) => (
                  <div key={k as string} className="grid grid-cols-2 gap-4 px-4 py-3 text-sm">
                    <div className="text-muted-foreground">{k}</div>
                    <div className="font-medium">{v || "—"}</div>
                  </div>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="warranty" className="pt-6 text-sm text-muted-foreground">
              Covered by Aurona {product.warranty ?? "1 Year"} manufacturer warranty against defects.
            </TabsContent>
            <TabsContent value="ship" className="pt-6 text-sm text-muted-foreground">
              PAN India delivery in 3–7 business days. Free shipping on orders over ₹999.
            </TabsContent>
          </Tabs>
        </div>

        {/* Related */}
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
            {featured.filter((p) => p.id !== product.id).slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} categoryIcon={cats.find((c) => c.id === p.category_id)?.icon} />
            ))}
          </div>
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
