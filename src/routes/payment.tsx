import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Banknote, ChevronLeft, Loader2, Lock, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCheckoutSummary } from "@/hooks/useCheckoutSummary";
import { FlowSteps } from "@/components/shop/FlowSteps";
import { PriceDetails } from "@/components/shop/PriceDetails";
import { EmptyState } from "@/components/empty/EmptyState";
import { placeOrder } from "@/lib/checkout.functions";
import { getPaymentAvailability, startPhonePePayment } from "@/lib/phonepe.functions";
import { clearFlow } from "@/lib/checkout-flow";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageLoading } from "@/components/layout/PageLoading";

export const Route = createFileRoute("/payment")({
  head: () => ({
    meta: [
      { title: "Payment — Aurona Lighting" },
      {
        name: "description",
        content:
          "Pay securely for your Aurona order with UPI, cards, netbanking or cash on delivery.",
      },
      { property: "og:title", content: "Payment — Aurona Lighting" },
      { property: "og:description", content: "Securely pay for your Aurona order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentPage,
});

function PaymentPage() {
  const navigate = useNavigate();
  const s = useCheckoutSummary();
  const [paying, setPaying] = useState(false);

  const availabilityFn = useServerFn(getPaymentAvailability);
  const startPhonePe = useServerFn(startPhonePePayment);
  const placeOrderFn = useServerFn(placeOrder);

  const { data: availability, isLoading: availabilityLoading } = useQuery({
    queryKey: ["payment-availability"],
    queryFn: () => availabilityFn({}),
    staleTime: 5 * 60 * 1000,
  });
  const onlineEnabled = Boolean(availability?.phonepe);
  const method = s.method === "cod" ? "cod" : onlineEnabled ? s.method : "cod";

  if (s.authLoading) return <PageLoading label="Loading payment options" />;
  if (!s.user)
    return (
      <EmptyState
        icon={Lock}
        eyebrow="Sign in required"
        title="Sign in to pay"
        description="Sign in to complete payment for your order securely."
        primary={{ label: "Sign in / Register", to: "/auth" }}
      />
    );
  if (!s.cart.loading && s.cart.items.length === 0)
    return (
      <EmptyState
        icon={Banknote}
        eyebrow="Payment"
        title="Nothing left to pay for"
        description="Your cart is empty. Add products and continue to checkout again."
        primary={{ label: "Explore products", to: "/products" }}
        secondary={{ label: "My orders", to: "/account" }}
      />
    );
  if (s.hydrated && !s.address && !s.addressesLoading)
    return (
      <EmptyState
        icon={Lock}
        eyebrow="Payment"
        title="Choose a delivery address first"
        description="We need your delivery address to confirm the final amount."
        primary={{ label: "Select address", to: "/address" }}
        secondary={{ label: "Back to cart", to: "/cart" }}
      />
    );

  const deliveryKnown = s.rates.length > 0;

  const pay = async () => {
    if (!s.address) {
      toast.error("Please select a delivery address.");
      return;
    }
    if (!s.rate) {
      toast.error("Sorry, delivery is not available to this pincode.");
      return;
    }
    setPaying(true);
    try {
      const result = await placeOrderFn({
        data: {
          address: {
            full_name: s.address.full_name,
            phone: s.address.phone.replace(/\D/g, "").slice(-10),
            email: s.user?.email ?? "",
            address: [s.address.line1, s.address.line2].filter(Boolean).join(", "),
            city: s.address.city,
            state: s.address.state,
            pincode: s.address.pincode,
          },
          payment_method: method as "cod" | "upi" | "card",
          shipping_rate_id: s.rate.id,
          ...(s.couponValid && s.couponCode ? { coupon_code: s.couponCode } : {}),
        },
      });

      if (method !== "cod") {
        const pp = await startPhonePe({
          data: { orderId: result.orderId, origin: window.location.origin },
        });
        if (pp.redirectUrl) {
          clearFlow();
          window.location.href = pp.redirectUrl;
          return;
        }
      }
      clearFlow();
      await navigate({ to: "/order-success", search: { order: result.orderId } });
    } catch (e) {
      toast.error(
        e instanceof Error && e.message
          ? e.message
          : "Payment could not be completed. Please try again.",
      );
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="pb-28 lg:pb-10">
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="container-x flex items-center gap-3 py-3">
          <Link to="/checkout" className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-surface">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold">Payment</h1>
        </div>
        <div className="container-x pb-3">
          <FlowSteps current="payment" />
        </div>
      </div>

      <div className="container-x grid gap-5 py-5 lg:grid-cols-[1fr_380px] lg:gap-8">
        <div className="space-y-4">
          <section className="rounded-2xl border border-border bg-surface p-5">
            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Payment summary
            </div>
            <div className="mt-1 text-3xl font-bold">{inr(s.total)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Includes {s.delivery === 0 ? "free delivery" : `delivery of ${inr(s.delivery)}`} to{" "}
              {s.address?.pincode}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Available payment methods
            </h2>

            <MethodCard
              icon={Smartphone}
              title="Online payment"
              subtitle={
                availabilityLoading
                  ? "Checking availability…"
                  : onlineEnabled
                    ? "UPI, cards and netbanking · secure payment gateway"
                    : "Online payment is temporarily unavailable. Please try again later."
              }
              selected={method !== "cod"}
              disabled={!onlineEnabled}
              onSelect={() => s.patchFlow({ method: "upi" })}
            />

            <MethodCard
              icon={Banknote}
              title="Cash on delivery"
              subtitle="Pay in cash when your order is delivered"
              selected={method === "cod"}
              onSelect={() => s.patchFlow({ method: "cod" })}
            />
          </section>

          <div className="flex items-center gap-2 rounded-2xl border border-border p-4 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
            Your payment is securely processed. We never store your card or UPI details.
          </div>
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
            disabled={paying || !deliveryKnown}
            onClick={pay}
          >
            {paying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {method === "cod" ? `Place order · ${inr(s.total)}` : `Pay ${inr(s.total)}`}
          </Button>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-40 border-t border-border bg-background px-4 py-3 lg:hidden">
        <Button
          className="h-12 w-full rounded-full text-base"
          disabled={paying || !deliveryKnown}
          onClick={pay}
        >
          {paying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {method === "cod" ? `Place order · ${inr(s.total)}` : `Pay ${inr(s.total)}`}
        </Button>
      </div>
    </div>
  );
}

function MethodCard({
  icon: Icon,
  title,
  subtitle,
  selected,
  disabled,
  onSelect,
}: {
  icon: typeof Banknote;
  title: string;
  subtitle: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition",
        selected && !disabled ? "border-primary bg-primary/5" : "border-border",
        disabled ? "cursor-not-allowed opacity-60" : "hover:border-primary/40",
      )}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <span
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-full border",
          selected && !disabled ? "border-primary" : "border-border",
        )}
      >
        {selected && !disabled && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
      </span>
    </button>
  );
}
