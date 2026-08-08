import { createFileRoute, Link } from "@tanstack/react-router";
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
import { detectAddressFromGeolocation } from "@/lib/shipping";
import { supabase } from "@/integrations/supabase/client";
import type { AddressRow } from "@/components/account/AddressManager";

import { useServerFn } from "@tanstack/react-start";
import { placeOrder } from "@/lib/checkout.functions";
import { quoteShipping } from "@/lib/shipping.functions";
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
  { label: "Delivery", icon: Truck },
  { label: "Payment", icon: CreditCard },
] as const;

function CheckoutPage() {
  const { user, loading } = useAuth();
  const cart = useCart();
  const [step, setStep] = useState<Step>(0);
  const [placing, setPlacing] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);

  const [f, setF] = useState({
    full_name: "", phone: "", email: user?.email ?? "",
    address: "", city: "", state: "", pincode: "",
    payment_method: "cod",
  });

  type DeliveryOption = { id: string; label: string; eta: string; price: number };
  const [rates, setRates] = useState<DeliveryOption[]>([]);
  const [rateId, setRateId] = useState<string | null>(null);
  const [shipMsg, setShipMsg] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);

  // Saved address book
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [saveAddr, setSaveAddr] = useState(true);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));



  // NOTE: every hook must run on every render — no early returns above this
  // block, otherwise React throws "Rendered more hooks than during the
  // previous render" the moment the cart or auth state resolves.
  const placeOrderFn = useServerFn(placeOrder);
  const availabilityFn = useServerFn(getPaymentAvailability);
  const startPhonePe = useServerFn(startPhonePePayment);
  const quoteFn = useServerFn(quoteShipping);
  const { data: pay } = useQuery({
    queryKey: ["payment-availability"],
    queryFn: () => availabilityFn({}),
    staleTime: 5 * 60 * 1000,
  });
  const onlineEnabled = Boolean(pay?.phonepe);

  useEffect(() => {
    if (user?.email && !f.email) setF((prev) => ({ ...prev, email: user.email ?? "" }));
  }, [user, f.email]);

  // Saved address book — remembered between orders so we never ask twice.
  const savedQuery = useQuery({
    queryKey: ["addresses", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addresses")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AddressRow[];
    },
  });
  const savedRows = savedQuery.data ?? [];

  const applySaved = (a: AddressRow) => {
    setSelectedAddressId(a.id);
    setAddingNew(false);
    setF((prev) => ({
      ...prev,
      full_name: a.full_name,
      phone: (a.phone || "").replace(/\D/g, "").slice(-10),
      address: [a.line1, a.line2].filter(Boolean).join(", "),
      city: a.city,
      state: a.state,
      pincode: a.pincode,
    }));
  };

  // Preselect the default/most recent saved address once.
  useEffect(() => {
    if (selectedAddressId || addingNew || savedRows.length === 0) return;
    applySaved(savedRows[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedRows.length]);

  const errors: Record<string, string | undefined> = {
    full_name: f.full_name.trim().length < 3 ? "Enter your full name (at least 3 characters)" : undefined,
    phone: !/^[6-9]\d{9}$/.test(f.phone.trim())
      ? "Enter a valid 10-digit mobile number starting with 6-9"
      : undefined,
    email:
      f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())
        ? "Enter a valid email address"
        : undefined,
    address: f.address.trim().length < 8 ? "Enter house / street / area (at least 8 characters)" : undefined,
    city: f.city.trim().length < 2 ? "Enter your city" : undefined,
    state: f.state.trim().length < 2 ? "Enter your state" : undefined,
    pincode: !/^\d{6}$/.test(f.pincode.trim()) ? "Enter a valid 6-digit pincode" : undefined,
  };
  const addressValid = Object.values(errors).every((e) => !e);


  // Live, server-authoritative shipping rates for the destination pincode.
  const cod = f.payment_method === "cod";
  useEffect(() => {
    if (step < 2 || !user || cart.items.length === 0) return;
    if (!/^\d{6}$/.test(f.pincode.trim())) {
      setRates([]);
      setShipMsg("Enter a valid 6-digit pincode to see delivery options.");
      return;
    }
    let cancel = false;
    setQuoting(true);
    quoteFn({ data: { pincode: f.pincode.trim(), cod } })
      .then((q) => {
        if (cancel) return;
        setRates(q.rates);
        setShipMsg(q.message ?? null);
        setRateId((prev) => (q.rates.some((r) => r.id === prev) ? prev : (q.rates[0]?.id ?? null)));
      })
      .catch(() => {
        if (!cancel) setShipMsg("Could not fetch delivery rates. Please try again.");
      })
      .finally(() => {
        if (!cancel) setQuoting(false);
      });
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, user, cart.items.length, cart.subtotal, f.pincode, cod]);

  const selectedRate = rates.find((r) => r.id === rateId) ?? rates[0];
  const shipping = selectedRate?.price ?? 0;
  const total = cart.subtotal + shipping;

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

  if (cart.items.length === 0)
    return (
      <div className="container-x py-24 text-center">
        <h1 className="text-display text-3xl">Your cart is empty</h1>
        <Button asChild className="mt-6 rounded-full"><Link to="/products">Explore products</Link></Button>
      </div>
    );

  const canNext = (() => {
    if (step === 0) return cart.items.length > 0;
    if (step === 1) return addressValid;
    if (step === 2) return !!selectedRate;
    return true;
  })();

  const goNext = () => {
    if (step === 1 && !addressValid) {
      setTouched({ full_name: true, phone: true, email: true, address: true, city: true, state: true, pincode: true });
      toast.error(errors.phone ?? "Please correct the highlighted fields.");
      return;
    }
    setStep((s) => Math.min(3, (s + 1) as Step) as Step);
  };

  const persistAddress = async () => {
    if (!user || selectedAddressId || !saveAddr) return;
    try {
      const { data, error } = await supabase
        .from("addresses")
        .insert({
          user_id: user.id,
          label: "Home",
          full_name: f.full_name.trim(),
          phone: f.phone.trim(),
          line1: f.address.trim(),
          city: f.city.trim(),
          state: f.state.trim(),
          pincode: f.pincode.trim(),
          is_default: savedRows.length === 0,
        })
        .select("id")
        .single();
      if (!error && data) {
        setSelectedAddressId(data.id);
        savedQuery.refetch();
      }
    } catch {
      // Saving the address book entry must never block the order.
    }
  };


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
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Something went wrong. Please try again later.");
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
              {savedRows.length > 0 && !addingNew && (
                <>
                  <div className="text-eyebrow">Select a delivery address</div>
                  <div className="mt-4 grid gap-2">
                    {savedRows.map((a) => (
                      <label
                        key={a.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition",
                          selectedAddressId === a.id ? "border-primary bg-primary/5" : "border-border hover:bg-surface",
                        )}
                      >
                        <input
                          type="radio"
                          name="addr"
                          className="mt-1"
                          checked={selectedAddressId === a.id}
                          onChange={() => applySaved(a)}
                        />
                        <div>
                          <div className="font-semibold text-foreground">
                            {a.full_name}
                            {a.label ? <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">{a.label}</span> : null}
                            {a.is_default ? <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-primary">Default</span> : null}
                          </div>
                          <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} — {a.pincode}
                            <br />Phone: {a.phone}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4 rounded-full"
                    onClick={() => { setAddingNew(true); setSelectedAddressId(null); setF({ ...f, full_name: "", phone: "", address: "", city: "", state: "", pincode: "" }); }}
                  >
                    <MapPin className="mr-2 h-3.5 w-3.5" /> Use a different address
                  </Button>
                </>
              )}

              {(savedRows.length === 0 || addingNew) && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="text-eyebrow">{savedRows.length > 0 ? "New delivery address" : "Delivery address"}</div>
                    <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={detect} disabled={detecting}>
                      {detecting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <MapPin className="mr-2 h-3.5 w-3.5" />}
                      Detect my location
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <F label="Full name" v={f.full_name} on={(v) => setF({ ...f, full_name: v })} error={touched.full_name ? errors.full_name : undefined} onBlur={() => touch("full_name")} />
                    <F
                      label="Phone number"
                      v={f.phone}
                      on={(v) => setF({ ...f, phone: v.replace(/\D/g, "").slice(0, 10) })}
                      onBlur={() => touch("phone")}
                      error={touched.phone ? errors.phone : undefined}
                      hint="10-digit Indian mobile number"
                      inputMode="numeric"
                      maxLength={10}
                    />
                    <F label="Email" v={f.email} on={(v) => setF({ ...f, email: v })} type="email" full onBlur={() => touch("email")} error={touched.email ? errors.email : undefined} />
                    <F label="Address (house, street, area)" v={f.address} on={(v) => setF({ ...f, address: v })} full onBlur={() => touch("address")} error={touched.address ? errors.address : undefined} />
                    <F label="City" v={f.city} on={(v) => setF({ ...f, city: v })} onBlur={() => touch("city")} error={touched.city ? errors.city : undefined} />
                    <F label="State" v={f.state} on={(v) => setF({ ...f, state: v })} onBlur={() => touch("state")} error={touched.state ? errors.state : undefined} />
                    <F
                      label="Pincode"
                      v={f.pincode}
                      on={(v) => setF({ ...f, pincode: v.replace(/\D/g, "").slice(0, 6) })}
                      onBlur={() => touch("pincode")}
                      error={touched.pincode ? errors.pincode : undefined}
                      inputMode="numeric"
                      maxLength={6}
                    />
                  </div>
                  <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={saveAddr} onChange={(e) => setSaveAddr(e.target.checked)} />
                    Save this address for faster checkout next time
                  </label>
                  {savedRows.length > 0 && (
                    <Button type="button" variant="ghost" size="sm" className="mt-3 rounded-full" onClick={() => setAddingNew(false)}>
                      Back to saved addresses
                    </Button>
                  )}
                </>
              )}
            </section>
          )}


          {step === 2 && (
            <section className="rounded-2xl border border-border p-6">
              <div className="text-eyebrow mb-4">Delivery</div>
              {quoting ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking delivery to {f.pincode || "your address"}…
                </div>
              ) : rates.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  {shipMsg ?? "No delivery options available for this pincode."}
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
                          <div className="text-xs text-muted-foreground">Arrives in {r.eta}</div>
                        </div>
                      </div>
                      <div className="font-semibold">{r.price === 0 ? "FREE Delivery" : inr(r.price)}</div>
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
                  {
                    v: "upi",
                    l: onlineEnabled ? "UPI — PhonePe, GPay, Paytm" : "UPI (coming soon)",
                    d: !onlineEnabled,
                  },
                  {
                    v: "card",
                    l: onlineEnabled
                      ? "Card / Netbanking — secured by PhonePe"
                      : "Card — Visa / Mastercard (coming soon)",
                    d: !onlineEnabled,
                  },
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
            <Row l="Delivery" v={selectedRate ? (shipping === 0 ? "FREE" : inr(shipping)) : "—"} />
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

function F({
  label,
  v,
  on,
  type = "text",
  full,
  error,
  hint,
  onBlur,
  inputMode,
  maxLength,
}: {
  label: string;
  v: string;
  on: (v: string) => void;
  type?: string;
  full?: boolean;
  error?: string;
  hint?: string;
  onBlur?: () => void;
  inputMode?: "text" | "numeric" | "tel" | "email";
  maxLength?: number;
}) {
  const invalid = Boolean(error);
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <Label className="text-xs">{label}</Label>
      <Input
        value={v}
        onChange={(e) => on(e.target.value)}
        onBlur={onBlur}
        type={type}
        inputMode={inputMode}
        maxLength={maxLength}
        aria-invalid={invalid}
        className={cn("mt-1 h-11", invalid && "border-destructive focus-visible:ring-destructive/40")}
      />
      {invalid ? (
        <p className="mt-1 text-xs font-medium text-destructive">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
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
