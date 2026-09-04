import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  LogIn,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Scale,
  Trash2,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { useWishlist } from "@/hooks/useWishlist";
import { useCompare } from "@/hooks/useCompare";
import { useCheckoutSummary } from "@/hooks/useCheckoutSummary";
import { ProductImage } from "@/components/product/ProductImage";
import { ProductCard } from "@/components/product/ProductCard";
import { EmptyState } from "@/components/empty/EmptyState";
import { PriceDetails } from "@/components/shop/PriceDetails";
import { CouponBox } from "@/components/shop/CouponBox";
import { FlowSteps } from "@/components/shop/FlowSteps";
import { productsQuery } from "@/lib/queries";
import { discountPct, inr } from "@/lib/format";
import { PageLoading } from "@/components/layout/PageLoading";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your Cart — Aurona Lighting" },
      {
        name: "description",
        content:
          "Review your Aurona lighting, fan and appliance selections, apply offers and continue to a secure checkout.",
      },
      { property: "og:title", content: "Your Cart — Aurona Lighting" },
      { property: "og:description", content: "Review your Aurona cart and continue to secure checkout." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { user, loading } = useAuth();
  const cart = useCart();
  const wl = useWishlist();
  const compare = useCompare();
  const navigate = useNavigate();
  const s = useCheckoutSummary();
  const recommended = useQuery(productsQuery({ bestseller: true, limit: 6 }));

  if (loading) return <PageLoading label="Loading your cart" />;
  if (cart.loading && cart.items.length === 0) return <PageLoading label="Loading your cart" />;
  if (cart.items.length === 0) return <EmptyCart />;

  const compareSlugs = cart.items.map((i) => i.products.slug).filter(Boolean);
  const compareInCart = compareSlugs.filter((s) => compare.has(s));
  const addAllToCompare = () => {
    let slots = compare.max - compare.count;
    for (const slug of compareSlugs) {
      if (compare.has(slug)) continue;
      if (slots <= 0) break;
      compare.toggle(slug);
      slots--;
    }
    navigate({ to: "/compare" });
  };



  const deliveryKnown = Boolean(s.address) && s.rates.length > 0;

  return (
    <div className="pb-28 lg:pb-10">
      {/* Page header */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="container-x flex items-center gap-3 py-3">
          <Link to="/products" className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-surface">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold">Cart</h1>
            <p className="text-xs text-muted-foreground">
              {cart.count} item{cart.count === 1 ? "" : "s"}
            </p>
          </div>
          <div className="hidden sm:block">
            <FlowSteps current="cart" />
          </div>
        </div>
      </div>

      <div className="container-x grid gap-5 py-5 lg:grid-cols-[1fr_380px] lg:gap-8">
        <div className="space-y-4">
          {/* Deliver to */}
          <Link
            to="/address"
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition hover:border-primary/40"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <MapPin className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              {s.address ? (
                <>
                  <span className="block text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    Deliver to
                  </span>
                  <span className="block truncate text-sm font-semibold">
                    {s.address.full_name} · {s.address.pincode}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {s.address.line1}, {s.address.city}, {s.address.state}
                  </span>
                </>
              ) : (
                <>
                  <span className="block text-sm font-semibold">Select a delivery address</span>
                  <span className="block text-xs text-muted-foreground">
                    We’ll show exact delivery charges and dates
                  </span>
                </>
              )}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>

          {s.address && (
            <div className="flex items-center gap-2 rounded-xl bg-success/10 px-4 py-2.5 text-xs font-semibold text-success">
              <Truck className="h-4 w-4 shrink-0" />
              {s.deliveryLoading
                ? "Checking delivery to your pincode…"
                : s.rate
                  ? `${s.rate.price === 0 ? "FREE delivery" : `Delivery ${inr(s.rate.price)}`} · arrives in ${s.rate.eta}`
                  : "Sorry, delivery is not available to this pincode."}
            </div>
          )}

          {/* Items */}
          <ul className="space-y-3">
            {cart.items.map((it) => {
              const off = discountPct(it.products.mrp, it.products.price);
              return (
                <li key={it.id} className="group relative overflow-hidden rounded-2xl border border-border bg-card p-3 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
                    <div className="flex gap-4 sm:contents">
                      <Link
                        to="/products/$slug"
                        params={{ slug: it.products.slug }}
                        className="shrink-0"
                      >
                        <ProductImage
                          product={it.products}
                          className="h-24 w-24 rounded-xl object-cover shadow-sm transition-transform group-hover:scale-105 sm:h-36 sm:w-36"
                          iconClassName="h-8 w-8 sm:h-10 sm:w-10"
                        />
                      </Link>

                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            to="/products/$slug"
                            params={{ slug: it.products.slug }}
                            className="line-clamp-2 text-sm font-bold leading-snug transition-colors hover:text-primary sm:text-lg sm:leading-tight"
                          >
                            {it.products.name}
                          </Link>
                          <button
                            onClick={() => cart.remove.mutate(it.id)}
                            className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive sm:hidden"
                            aria-label="Remove item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <p className="mt-1 truncate text-[10px] tracking-wide text-muted-foreground uppercase sm:text-xs">
                          {it.products.unit ? `${it.products.unit} · ` : ""}SKU: {it.products.sku}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col sm:mt-0">
                      <div className="hidden sm:flex items-start justify-end">
                        <button
                          onClick={() => cart.remove.mutate(it.id)}
                          className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-2 sm:pt-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-black tracking-tight sm:text-2xl">{inr(it.products.price)}</span>
                            {off > 0 && (
                              <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-black text-success sm:text-xs">
                                {off}% OFF
                              </span>
                            )}
                          </div>
                          {off > 0 && (
                            <div className="text-[10px] text-muted-foreground line-through sm:text-xs">
                              MRP {inr(it.products.mrp)}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3 sm:gap-4">
                          <button
                            onClick={() => compare.toggle(it.products.slug, it.products.name)}
                            className={
                              "flex items-center gap-1.5 text-xs font-bold transition-colors hover:text-primary " +
                              (compare.has(it.products.slug) ? "text-primary" : "text-muted-foreground")
                            }
                          >
                            <Scale className="h-4 w-4" /> <span className="hidden sm:inline">Compare</span>
                          </button>

                          <button
                            onClick={() => {
                              wl.toggle.mutate({ productId: it.product_id, sku: it.products.sku });
                              cart.remove.mutate(it.id);
                            }}
                            className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-primary"
                          >
                            <Heart className="h-4 w-4" /> <span className="hidden sm:inline">Save</span>
                          </button>

                          <div className="flex items-center gap-1 rounded-full border border-border bg-secondary/30 p-1">
                            <button
                              aria-label="Decrease quantity"
                              onClick={() =>
                                cart.updateQty.mutate({ id: it.id, quantity: Math.max(1, it.quantity - 1) })
                              }
                              className="grid h-7 w-7 place-items-center rounded-full hover:bg-background transition-colors sm:h-8 sm:w-8"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-6 text-center text-xs font-black sm:w-8 sm:text-sm">{it.quantity}</span>
                            <button
                              aria-label="Increase quantity"
                              onClick={() =>
                                cart.updateQty.mutate({ id: it.id, quantity: it.quantity + 1 })
                              }
                              className="grid h-7 w-7 place-items-center rounded-full hover:bg-background transition-colors sm:h-8 sm:w-8"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>

              );
            })}
          </ul>

          {/* Compare from cart — uses the same comparison system as the storefront */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center gap-2 text-sm">
              <Scale className="h-4 w-4 shrink-0 text-primary" />
              <span className="font-semibold">Compare items</span>
              <span className="text-xs text-muted-foreground">
                {compareInCart.length > 0
                  ? `${compareInCart.length} of these items selected (max ${compare.max})`
                  : `Pick up to ${compare.max} items to compare specs side by side`}
              </span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="rounded-full" onClick={addAllToCompare}>
                Compare cart items
              </Button>
              {compare.count > 1 && (
                <Button asChild size="sm" className="rounded-full">
                  <Link to="/compare">View comparison ({compare.count})</Link>
                </Button>
              )}
            </div>
          </div>



          <CouponBox
            code={s.couponCode}
            valid={s.couponValid}
            checking={s.couponChecking}
            reason={s.couponReason}
            discount={s.discount}
            onApply={(c) => s.patchFlow({ coupon: c })}
            onRemove={() => s.patchFlow({ coupon: null })}
          />

          <div className="flex items-center gap-2 rounded-2xl border border-border p-4 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
            Safe and secure payments · Genuine Aurona products with warranty
          </div>

          {/* Recommended */}
          {(recommended.data?.length ?? 0) > 0 && (
            <section className="pt-2">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
                You might also like
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {(recommended.data ?? []).slice(0, 4).map((p) => (
                  <ProductCard key={p.id} product={p} compact nameOnly />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="h-fit space-y-4 lg:sticky lg:top-24">
          <PriceDetails
            count={cart.count}
            subtotal={s.subtotal}
            mrpSavings={s.mrpSavings}
            discount={s.discount}
            couponCode={s.couponValid ? s.couponCode : null}
            delivery={s.delivery}
            deliveryKnown={deliveryKnown}
            total={s.total}
          />
          <Button
            className="hidden h-12 w-full rounded-full text-base lg:flex"
            onClick={() => navigate({ to: "/address" })}
          >
            {s.address ? "Continue to checkout" : "Select delivery address"}
          </Button>
        </aside>
      </div>

      {/* Mobile sticky action bar */}
      <div className="fixed inset-x-0 bottom-16 z-40 border-t border-border bg-background px-4 py-3 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Total</div>
            <div className="text-lg font-bold leading-tight">{inr(s.total)}</div>
          </div>
          <Button
            className="h-12 flex-1 rounded-full text-base"
            onClick={() => navigate({ to: "/address" })}
          >
            Place order
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyCart() {
  return (
    <EmptyState
      icon={ShoppingBag}
      eyebrow="Your cart"
      title="Your cart is waiting"
      description="Discover premium lighting, fans and appliances — add your favourites to bring them home."
      primary={{ label: "Start shopping", to: "/products" }}
      secondary={{ label: "Browse categories", to: "/" }}
    />
  );
}

function SignInPrompt() {
  return (
    <EmptyState
      icon={LogIn}
      eyebrow="Sign in required"
      title="Sign in to view your cart"
      description="Your saved items, addresses and one-tap checkout are one step away."
      primary={{ label: "Sign in / Register", to: "/auth" }}
      secondary={{ label: "Continue browsing", to: "/products" }}
    />
  );
}
