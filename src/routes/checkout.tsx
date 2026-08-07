import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, MapPin, ChevronLeft, ChevronRight, Loader2, Truck, CreditCard, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  detectAddressFromGeolocation,
  getShippingRates,
  type ShippingRate,
} from "@/lib/shipping";
import { useServerFn } from "@tanstack/react-start";
import { placeOrder } from "@/lib/checkout.functions";
import { getPaymentAvailability, startPhonePePayment } from "@/lib/phonepe.functions";
import { useQuery } from "@tanstack/react-query";


export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Secure Checkout | Aurona Lighting" },
      { name: "description", content: "Complete your Aurona Lighting order with secure checkout and delivery across India." },
      { property: "og:title", content: "Secure Checkout | Aurona Lighting" },
      { property: "og:description", content: "Complete your Aurona Lighting order with secure checkout and delivery across India." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckoutPage,
});

type Step = 0 | 1 | 2 | 3;
const STEPS = [
  { label: "Cart", icon: ShoppingBag },
  { label: "Address", icon: MapPin },
  { label: "Shipping", icon: Truck },
  { label: "Payment", icon: CreditCard },
] as const;

function CheckoutPage() {
  const { user, loading } = useAuth();
  const cart = useCart();
  const nav = useNavigate();
  const [step, setStep] = useState<Step>(0);
  const [placing, setPlacing] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);

  const [f, setF] = useState({
    full_name: "", phone: "", email: user?.email ?? "",
    address: "", city: "", state: "", pincode: "",
    payment_method: "cod",
  });

  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [rateId, setRateId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email && !f.email) setF((prev) => ({ ...prev, email: user.email ?? "" }));
  }, [user, f.email]);

  // Recompute shipping when entering step 2 or subtotal changes
  useEffect(() => {
    if (step < 2) return;
    let cancel = false;
    getShippingRates({ subtotal: cart.subtotal, address: f, itemCount: cart.count }).then((r) => {
      if (cancel) return;
      setRates(r);
      setRateId((prev) => prev ?? r[0]?.id ?? null);
    });
    return () => { cancel = true; };
  }, [step, cart.subtotal, cart.count, f]);

  if (loading) return null;
  if (!user)
    return (
      <div className="container-x py-24 text-center">
        <h1 className="text-display text-3xl">Sign in to checkout</h1>
        <Button asChild className="mt-6 rounded-full"><Link to="/auth">Sign in</Link></Button>
      </div>
    );

  if (done)
    return (
      <div className="container-x py-24 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
        <h1 className="text-display mt-4 text-4xl">Order placed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your order number is <span className="font-semibold text-foreground">{done}</span>
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild variant="outline" className="rounded-full"><Link to="/products">Continue shopping</Link></Button>
          <Button asChild className="rounded-full"><Link to="/account">View orders</Link></Button>
        </div>
      </div>
    );

  if (cart.items.length === 0 && !done)
    return (
      <div className="container-x py-24 text-center">
        <h1 className="text-display text-3xl">Your cart is empty</h1>
        <Button asChild className="mt-6 rounded-full"><Link to="/products">Explore products</Link></Button>
      </div>
    );

  const selectedRate = rates.find((r) => r.id === rateId) ?? rates[0];
  const shipping = selectedRate?.price ?? 0;
  const total = cart.subtotal + shipping;

  const canNext = (() => {
    if (step === 0) return cart.items.length > 0;
    if (step === 1) return f.full_name && f.phone && f.address && f.city && f.state && f.pincode.length >= 5;
    if (step === 2) return !!selectedRate;
    return true;
  })();

  const detect = async () => {
    setDetecting(true);
    try {
      const g = await detectAddressFromGeolocation();
      if (!g) {
        toast.error("Couldn't detect location. Please allow location access or fill manually.");
        return;
      }
      setF((prev) => ({
        ...prev,
        city: g.city || prev.city,
        state: g.state || prev.state,
        pincode: g.pincode || prev.pincode,
        address: prev.address || g.address || "",
      }));
      toast.success("Address auto-filled from your location");
    } finally {
      setDetecting(false);
    }
  };

  const placeOrderFn = useServerFn(placeOrder);
  const availabilityFn = useServerFn(getPaymentAvailability);
  const startPhonePe = useServerFn(startPhonePePayment);
  const { data: pay } = useQuery({
    queryKey: ["payment-availability"],
    queryFn: () => availabilityFn({}),
    staleTime: 5 * 60 * 1000,
  });
  const onlineEnabled = Boolean(pay?.phonepe);

  const place = async () => {
    if (!selectedRate) {
      toast.error("Please select a shipping method.");
      return;
    }
    setPlacing(true);
    try {
      const result = await placeOrderFn({
        data: {
          address: {
            full_name: f.full_name,
            phone: f.phone,
            email: f.email,
            address: f.address,
            city: f.city,
            state: f.state,
            pincode: f.pincode,
          },
          payment_method: f.payment_method as "cod" | "upi" | "card",
          shipping_rate_id: selectedRate.id,
        },
      });
      await cart.clear.mutateAsync().catch(() => {});

      if (f.payment_method !== "cod" && onlineEnabled) {
        try {
          const pp = await startPhonePe({
            data: { orderId: result.orderId, origin: window.location.origin },
          });
          if (pp.redirectUrl) {
            window.location.href = pp.redirectUrl;
            return;
          }
        } catch {
          toast.error("Could not open the payment page. Your order is saved as pending payment.");
        }
      }
      setDone(result.orderNumber);
    } catch {
      // Detailed errors are logged server-side; users see a generic message.
      toast.error("Something went wrong. Please try again later.");
    } finally {
      setPlacing(false);
    }
  };


  return (
    <div className="container-x py-8">
      <h1 className="text-display text-3xl sm:text-4xl">Checkout</h1>

      {/* Stepper */}
      <ol className="mt-6 flex flex-wrap items-center gap-2 text-xs">
        {STEPS.map((s, i) => {
          const active = i === step;
          const complete = i < step;
          const Icon = s.icon;
          return (
            <li key={s.label} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => i <= step && setStep(i as Step)}
                disabled={i > step}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 font-semibold transition",
                  active && "border-primary bg-primary text-primary-foreground",
                  complete && "border-primary/40 bg-primary/10 text-primary",
                  !active && !complete && "border-border text-muted-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{i + 1}. {s.label}</span>
              </button>
              {i < STEPS.length - 1 && <span className="h-px w-6 bg-border" aria-hidden />}
            </li>
          );
        })}
      </ol>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {step === 0 && (
            <section className="rounded-2xl border border-border p-6">
              <div className="text-eyebrow mb-4">Review your cart</div>
              <ul className="divide-y divide-border">
                {cart.items.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <div className="font-medium text-foreground">{i.products.name}</div>
                      <div className="text-xs text-muted-foreground">Qty {i.quantity} · {inr(i.products.price)}</div>
                    </div>
                    <div className="font-semibold">{inr(i.products.price * i.quantity)}</div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex justify-end">
                <Button asChild variant="outline" className="rounded-full">
                  <Link to="/cart">Edit cart</Link>
                </Button>
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="rounded-2xl border border-border p-6">
              <div className="flex items-center justify-between">
                <div className="text-eyebrow">Shipping address</div>
                <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={detect} disabled={detecting}>
                  {detecting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <MapPin className="mr-2 h-3.5 w-3.5" />}
                  Detect my location
                </Button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <F label="Full name" v={f.full_name} on={(v) => setF({ ...f, full_name: v })} />
                <F label="Phone" v={f.phone} on={(v) => setF({ ...f, phone: v })} />
                <F label="Email" v={f.email} on={(v) => setF({ ...f, email: v })} type="email" full />
                <F label="Address" v={f.address} on={(v) => setF({ ...f, address: v })} full />
                <F label="City" v={f.city} on={(v) => setF({ ...f, city: v })} />
                <F label="State" v={f.state} on={(v) => setF({ ...f, state: v })} />
                <F label="Pincode" v={f.pincode} on={(v) => setF({ ...f, pincode: v })} />
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="rounded-2xl border border-border p-6">
              <div className="text-eyebrow mb-4">Shipping method</div>
              {rates.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Fetching best rates for {f.pincode || "your address"}…
                </div>
              ) : (
                <div className="grid gap-2">
                  {rates.map((r) => (
                    <label
                      key={r.id}
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-4 rounded-xl border px-4 py-3 text-sm transition",
                        rateId === r.id ? "border-primary bg-primary/5" : "border-border hover:bg-surface",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="rate"
                          value={r.id}
                          checked={rateId === r.id}
                          onChange={() => setRateId(r.id)}
                        />
                        <div>
                          <div className="font-medium text-foreground">{r.label}</div>
                          <div className="text-xs text-muted-foreground">{r.eta} · via {r.provider}</div>
                        </div>
                      </div>
                      <div className="font-semibold">{r.price === 0 ? "Free" : inr(r.price)}</div>
                    </label>
                  ))}
                </div>
              )}
            </section>
          )}

          {step === 3 && (
            <section className="rounded-2xl border border-border p-6">
              <div className="text-eyebrow mb-4">Payment</div>
              <div className="grid gap-2">
                {[
                  { v: "cod", l: "Cash on Delivery" },
                  { v: "upi", l: "UPI (coming soon)", d: true },
                  { v: "card", l: "Card — Visa / Mastercard (coming soon)", d: true },
                ].map((opt) => (
                  <label
                    key={opt.v}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm",
                      opt.d ? "opacity-50" : "cursor-pointer hover:bg-surface",
                      f.payment_method === opt.v && !opt.d && "border-primary bg-primary/5",
                    )}
                  >
                    <input
                      type="radio"
                      name="pay"
                      value={opt.v}
                      disabled={opt.d}
                      checked={f.payment_method === opt.v}
                      onChange={() => setF({ ...f, payment_method: opt.v })}
                    />
                    {opt.l}
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* Nav */}
          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, (s - 1) as Step) as Step)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            {step < 3 ? (
              <Button
                type="button"
                className="rounded-full"
                disabled={!canNext}
                onClick={() => setStep((s) => Math.min(3, (s + 1) as Step) as Step)}
              >
                Continue <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" className="h-12 rounded-full px-6" disabled={placing} onClick={place}>
                {placing ? "Placing order…" : `Place order · ${inr(total)}`}
              </Button>
            )}
          </div>
        </div>

        <aside className="h-fit rounded-2xl border border-border bg-surface p-6">
          <div className="text-eyebrow mb-4">Order summary</div>
          <div className="space-y-2 text-sm">
            <Row l={`Subtotal (${cart.count})`} v={inr(cart.subtotal)} />
            <Row l="Shipping" v={selectedRate ? (shipping === 0 ? "Free" : inr(shipping)) : "—"} />
            <div className="my-2 h-px bg-border" />
            <Row l="Total" v={inr(total)} bold />
          </div>
          {selectedRate && (
            <p className="mt-3 text-xs text-muted-foreground">
              {selectedRate.label} · {selectedRate.eta}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function F({ label, v, on, type = "text", full }: { label: string; v: string; on: (v: string) => void; type?: string; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <Label className="text-xs">{label}</Label>
      <Input value={v} onChange={(e) => on(e.target.value)} type={type} required className="mt-1 h-11" />
    </div>
  );
}
function Row({ l, v, bold }: { l: string; v: string; bold?: boolean }) {
  return (
    <div className={"flex justify-between " + (bold ? "text-base font-semibold" : "text-muted-foreground")}>
      <span>{l}</span><span className={bold ? "" : "text-foreground"}>{v}</span>
    </div>
  );
}
