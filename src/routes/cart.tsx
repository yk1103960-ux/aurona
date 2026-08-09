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
  Trash2,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { useWishlist } from "@/hooks/useWishlist";
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
  const navigate = useNavigate();
  const s = useCheckoutSummary();
  const recommended = useQuery(productsQuery({ bestseller: true, limit: 6 }));

  if (loading) return <PageLoading label="Loading your cart" />;
  if (!user) return <SignInPrompt />;
  if (cart.loading && cart.items.length === 0) return <PageLoading label="Loading your cart" />;
  if (cart.items.length === 0) return <EmptyCart />;

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
                <li key={it.id} className="rounded-2xl border border-border p-3 sm:p-4">
                  <div className="flex gap-3">
                    <Link
                      to="/products/$slug"
                      params={{ slug: it.products.slug }}
                      className="shrink-0"
                    >
                      <ProductImage
                        product={it.products}
                        className="h-24 w-24 rounded-xl sm:h-28 sm:w-28"
                        iconClassName="h-8 w-8"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        to="/products/$slug"
                        params={{ slug: it.products.slug }}
                        className="line-clamp-2 text-sm font-semibold hover:text-primary"
                      >
                        {it.products.name}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {it.products.unit ? `${it.products.unit} · ` : ""}SKU {it.products.sku}
                      </p>
                      <div className="mt-2 flex flex-wrap items-baseline gap-2">
                        <span className="text-base font-bold">{inr(it.products.price)}</span>
                        {off > 0 && (
                          <>
                            <span className="text-xs text-muted-foreground line-through">
                              {inr(it.products.mrp)}
                            </span>
                            <span className="text-xs font-bold text-success">{off}% off</span>
                          </>
                        )}
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <div className="flex items-center rounded-full border border-border">
                          <button
                            aria-label="Decrease quantity"
                            onClick={() =>
                              cart.updateQty.mutate({ id: it.id, quantity: it.quantity - 1 })
                            }
                            className="grid h-8 w-8 place-items-center"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm font-bold">{it.quantity}</span>
                          <button
                            aria-label="Increase quantity"
                            onClick={() =>
                              cart.updateQty.mutate({ id: it.id, quantity: it.quantity + 1 })
                            }
                            className="grid h-8 w-8 place-items-center"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            wl.toggle.mutate({ productId: it.product_id, sku: it.products.sku });
                            cart.remove.mutate(it.id);
                          }}
                          className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-primary"
                        >
                          <Heart className="h-3.5 w-3.5" /> Save
                        </button>
                        <button
                          onClick={() => cart.remove.mutate(it.id)}
                          className="ml-auto flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

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
                  <ProductCard key={p.id} product={p} compact />
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
