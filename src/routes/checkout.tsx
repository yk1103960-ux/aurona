import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Loader2, MapPin, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCheckoutSummary } from "@/hooks/useCheckoutSummary";
import { FlowSteps } from "@/components/shop/FlowSteps";
import { PriceDetails } from "@/components/shop/PriceDetails";
import { CouponBox } from "@/components/shop/CouponBox";
import { ProductImage } from "@/components/product/ProductImage";
import { EmptyState } from "@/components/empty/EmptyState";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageLoading } from "@/components/layout/PageLoading";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Order Review — Aurona Lighting" },
      {
        name: "description",
        content:
          "Review your Aurona order: delivery address, items, delivery charges and the final amount before payment.",
      },
      { property: "og:title", content: "Order Review — Aurona Lighting" },
      { property: "og:description", content: "Review your Aurona order before payment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const navigate = useNavigate();
  const s = useCheckoutSummary();

  if (s.authLoading) return <PageLoading label="Loading checkout" />;
  if (!s.user)
    return (
      <EmptyState
        icon={MapPin}
        eyebrow="Sign in required"
        title="Sign in to continue"
        description="Sign in to review your order and complete payment securely."
        primary={{ label: "Sign in / Register", to: "/auth" }}
        secondary={{ label: "Continue browsing", to: "/products" }}
      />
    );
  if (!s.cart.loading && s.cart.items.length === 0)
    return (
      <EmptyState
        icon={Truck}
        eyebrow="Checkout"
        title="Your cart is empty"
        description="Add a few products to your cart to continue to checkout."
        primary={{ label: "Explore products", to: "/products" }}
      />
    );
  if (s.hydrated && !s.address && !s.addressesLoading)
    return (
      <EmptyState
        icon={MapPin}
        eyebrow="Checkout"
        title="Choose a delivery address"
        description="We need a delivery address to calculate delivery charges and expected delivery dates."
        primary={{ label: "Select address", to: "/address" }}
        secondary={{ label: "Back to cart", to: "/cart" }}
      />
    );

  const deliveryKnown = s.rates.length > 0;
  const canPay = Boolean(s.address) && deliveryKnown && s.cart.items.length > 0;

  return (
    <div className="pb-28 lg:pb-10">
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="container-x flex items-center gap-3 py-3">
          <Link to="/address" className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-surface">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold">Order review</h1>
        </div>
        <div className="container-x pb-3">
          <FlowSteps current="checkout" />
        </div>
      </div>

      <div className="container-x grid gap-5 py-5 lg:grid-cols-[1fr_380px] lg:gap-8">
        <div className="space-y-4">
          {/* Address */}
          <section className="rounded-2xl border border-border p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Delivery address
              </h2>
              <Link to="/address" className="text-xs font-bold text-primary">
                Change
              </Link>
            </div>
            {s.address ? (
              <p className="mt-3 text-sm leading-relaxed">
                <span className="font-semibold">{s.address.full_name}</span>
                <br />
                <span className="text-muted-foreground">
                  {s.address.line1}
                  {s.address.line2 ? `, ${s.address.line2}` : ""}
                  {s.address.landmark ? `, Landmark: ${s.address.landmark}` : ""}
                  <br />
                  {s.address.city}, {s.address.state} — {s.address.pincode}
                  <br />
                  Mobile: {s.address.phone}
                </span>
              </p>
            ) : (
              <div className="mt-3 h-16 animate-pulse rounded-xl bg-surface" />
            )}
          </section>

          {/* Items */}
          <section className="rounded-2xl border border-border">
            <h2 className="border-b border-border p-4 text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
              {s.cart.count} item{s.cart.count === 1 ? "" : "s"}
            </h2>
            <ul className="divide-y divide-border">
              {s.cart.items.map((it) => (
                <li key={it.id} className="flex gap-3 p-4">
                  <ProductImage
                    product={it.products}
                    className="h-16 w-16 shrink-0 rounded-xl"
                    iconClassName="h-6 w-6"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold">{it.products.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Qty {it.quantity}</p>
                  </div>
                  <div className="shrink-0 text-sm font-bold">
                    {inr(Number(it.products.price) * it.quantity)}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Delivery */}
          <section className="rounded-2xl border border-border p-4">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Delivery
            </h2>
            {s.deliveryLoading ? (
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Calculating delivery for{" "}
                {s.address?.pincode}…
              </div>
            ) : s.rates.length === 0 ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Sorry, delivery is not available to this pincode.
                </p>
                <Button asChild variant="outline" size="sm" className="rounded-full">
                  <Link to="/address">Change address</Link>
                </Button>
              </div>
            ) : (
              <div className="mt-3 grid gap-2">
                {s.rates.map((r) => (
                  <label
                    key={r.id}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm transition",
                      s.rate?.id === r.id ? "border-primary bg-primary/5" : "border-border",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <input
                        type="radio"
                        name="rate"
                        className="shrink-0"
                        checked={s.rate?.id === r.id}
                        onChange={() => s.patchFlow({ rateId: r.id })}
                      />
                      <span className="min-w-0">
                        <span className="block font-semibold">{r.label}</span>
                        <span className="block text-xs text-muted-foreground">Arrives in {r.eta}</span>
                      </span>
                    </span>
                    <span className={cn("shrink-0 font-bold", r.price === 0 && "text-success")}>
                      {r.price === 0 ? "FREE" : inr(r.price)}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </section>

          <CouponBox
            code={s.couponCode}
            valid={s.couponValid}
            checking={s.couponChecking}
            reason={s.couponReason}
            discount={s.discount}
            onApply={(c) => s.patchFlow({ coupon: c })}
            onRemove={() => s.patchFlow({ coupon: null })}
          />
        </div>

        <aside className="h-fit space-y-4 lg:sticky lg:top-24">
          <PriceDetails
            count={s.cart.count}
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
            disabled={!canPay}
            onClick={() => navigate({ to: "/payment" })}
          >
            Continue to payment
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            The final amount is confirmed by our servers before payment.
          </p>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-40 border-t border-border bg-background px-4 py-3 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Total</div>
            <div className="text-lg font-bold leading-tight">{inr(s.total)}</div>
          </div>
          <Button
            className="h-12 flex-1 rounded-full text-base"
            disabled={!canPay}
            onClick={() => navigate({ to: "/payment" })}
          >
            Continue to payment
          </Button>
        </div>
      </div>
    </div>
  );
}
