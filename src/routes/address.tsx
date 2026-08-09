import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Loader2, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCheckoutSummary } from "@/hooks/useCheckoutSummary";
import { FlowSteps } from "@/components/shop/FlowSteps";
import { EmptyState } from "@/components/empty/EmptyState";
import { detectAddressFromGeolocation } from "@/lib/shipping";
import { cn } from "@/lib/utils";
import type { AddressRow } from "@/components/account/AddressManager";
import { PageLoading } from "@/components/layout/PageLoading";

export const Route = createFileRoute("/address")({
  head: () => ({
    meta: [
      { title: "Select Delivery Address — Aurona Lighting" },
      {
        name: "description",
        content:
          "Choose or add your delivery address to see exact Aurona delivery charges and estimated delivery dates.",
      },
      { property: "og:title", content: "Select Delivery Address — Aurona Lighting" },
      {
        property: "og:description",
        content: "Choose or add a delivery address for your Aurona order.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AddressPage,
});

type Form = {
  full_name: string;
  phone: string;
  house: string;
  street: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
};

const EMPTY: Form = {
  full_name: "",
  phone: "",
  house: "",
  street: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
  is_default: false,
};

function validate(f: Form) {
  return {
    full_name: f.full_name.trim().length < 3 ? "Enter your full name" : undefined,
    phone: !/^[6-9]\d{9}$/.test(f.phone.trim())
      ? "Enter a valid 10-digit mobile number starting with 6-9"
      : undefined,
    house: f.house.trim().length < 2 ? "Enter your house / flat number" : undefined,
    street: f.street.trim().length < 3 ? "Enter your street or area" : undefined,
    city: f.city.trim().length < 2 ? "Enter your city" : undefined,
    state: f.state.trim().length < 2 ? "Enter your state" : undefined,
    pincode: !/^[1-9]\d{5}$/.test(f.pincode.trim()) ? "Enter a valid 6-digit Indian pincode" : undefined,
  } as Record<string, string | undefined>;
}

function AddressPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const s = useCheckoutSummary();

  const [form, setForm] = useState<Form>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [detecting, setDetecting] = useState(false);
  const errors = validate(form);
  const valid = Object.values(errors).every((e) => !e);

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in to save an address");
      const payload = {
        user_id: user.id,
        label: "Home",
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        line1: `${form.house.trim()}, ${form.street.trim()}`,
        line2: form.landmark.trim() || null,
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        is_default: form.is_default || s.addresses.length === 0,
      };
      if (editingId) {
        const { error } = await supabase.from("addresses").update(payload).eq("id", editingId);
        if (error) throw error;
        return editingId;
      }
      const { data, error } = await supabase.from("addresses").insert(payload).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: ["addresses"] });
      s.patchFlow({ addressId: id, rateId: null });
      setOpen(false);
      setEditingId(null);
      setForm(EMPTY);
      setTouched({});
      toast.success("Address saved");
    },
    onError: () => toast.error("We couldn’t save this address. Please check the details and try again."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("addresses").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: async (id) => {
      if (s.flow.addressId === id) s.patchFlow({ addressId: null, rateId: null });
      await qc.invalidateQueries({ queryKey: ["addresses"] });
      toast.success("Address removed");
    },
    onError: () => toast.error("We couldn’t remove this address. Please try again."),
  });

  const makeDefault = useMutation({
    mutationFn: async (id: string) => {
      if (!user) return;
      await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
      const { error } = await supabase.from("addresses").update({ is_default: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["addresses"] }),
  });

  const startEdit = (a: AddressRow) => {
    const [house, ...rest] = (a.line1 ?? "").split(",");
    setEditingId(a.id);
    setForm({
      full_name: a.full_name,
      phone: (a.phone || "").replace(/\D/g, "").slice(-10),
      house: (house ?? "").trim(),
      street: rest.join(",").trim(),
      landmark: a.line2 ?? "",
      city: a.city,
      state: a.state,
      pincode: a.pincode,
      is_default: a.is_default,
    });
    setTouched({});
    setOpen(true);
  };

  const detect = async () => {
    setDetecting(true);
    try {
      const g = await detectAddressFromGeolocation();
      if (!g) {
        toast.error("Couldn’t detect your location. Please allow location access or fill it manually.");
        return;
      }
      setForm((p) => ({
        ...p,
        city: g.city || p.city,
        state: g.state || p.state,
        pincode: g.pincode || p.pincode,
        street: p.street || g.address || "",
      }));
      toast.success("Location details filled in");
    } finally {
      setDetecting(false);
    }
  };

  if (loading) return <PageLoading label="Loading your addresses" />;
  if (!user)
    return (
      <EmptyState
        icon={MapPin}
        eyebrow="Sign in required"
        title="Sign in to manage addresses"
        description="Save delivery addresses once and reuse them on every order."
        primary={{ label: "Sign in / Register", to: "/auth" }}
        secondary={{ label: "Back to cart", to: "/cart" }}
      />
    );

  return (
    <div className="pb-28 lg:pb-10">
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="container-x flex items-center gap-3 py-3">
          <Link to="/cart" className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-surface">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold">Select delivery address</h1>
          <div className="hidden sm:block">
            <FlowSteps current="address" />
          </div>
        </div>
      </div>

      <div className="container-x grid gap-5 py-5 lg:grid-cols-[1fr_380px] lg:gap-8">
        <div className="space-y-3">
          {s.addressesLoading && <div className="h-24 animate-pulse rounded-2xl bg-surface" />}

          {s.addresses.map((a) => {
            const selected = s.flow.addressId === a.id;
            return (
              <div
                key={a.id}
                className={cn(
                  "rounded-2xl border p-4 transition",
                  selected ? "border-primary bg-primary/5" : "border-border",
                )}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="radio"
                    name="addr"
                    className="mt-1.5 shrink-0"
                    checked={selected}
                    onChange={() => s.patchFlow({ addressId: a.id, rateId: null })}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{a.full_name}</span>
                      {a.is_default && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {a.line1}
                      {a.line2 ? `, ${a.line2}` : ""}
                      <br />
                      {a.city}, {a.state} — {a.pincode}
                      <br />
                      Mobile: {a.phone}
                    </p>
                  </div>
                </label>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs font-semibold">
                  <button
                    onClick={() => startEdit(a)}
                    className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 hover:text-primary"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  {!a.is_default && (
                    <button
                      onClick={() => makeDefault.mutate(a.id)}
                      className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 hover:text-primary"
                    >
                      <Star className="h-3.5 w-3.5" /> Set default
                    </button>
                  )}
                  <button
                    onClick={() => remove.mutate(a.id)}
                    className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            );
          })}

          {!open ? (
            <button
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY);
                setTouched({});
                setOpen(true);
              }}
              className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border p-4 text-sm font-semibold text-primary hover:bg-surface"
            >
              <Plus className="h-4 w-4" /> Add new address
            </button>
          ) : (
            <form
              className="rounded-2xl border border-border p-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!valid) {
                  setTouched(Object.fromEntries(Object.keys(errors).map((k) => [k, true])));
                  toast.error("Please correct the highlighted fields.");
                  return;
                }
                save.mutate();
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold">{editingId ? "Edit address" : "Add a new address"}</h2>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={detect}
                  disabled={detecting}
                >
                  {detecting ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <MapPin className="mr-2 h-3.5 w-3.5" />
                  )}
                  Use my location
                </Button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Full name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} error={touched.full_name ? errors.full_name : undefined} onBlur={() => setTouched({ ...touched, full_name: true })} />
                <Field
                  label="Mobile number"
                  value={form.phone}
                  onChange={(v) => setForm({ ...form, phone: v.replace(/\D/g, "").slice(0, 10) })}
                  error={touched.phone ? errors.phone : undefined}
                  onBlur={() => setTouched({ ...touched, phone: true })}
                  inputMode="numeric"
                  maxLength={10}
                />
                <Field label="House / flat / building" value={form.house} onChange={(v) => setForm({ ...form, house: v })} error={touched.house ? errors.house : undefined} onBlur={() => setTouched({ ...touched, house: true })} />
                <Field label="Street / area" value={form.street} onChange={(v) => setForm({ ...form, street: v })} error={touched.street ? errors.street : undefined} onBlur={() => setTouched({ ...touched, street: true })} />
                <Field label="Landmark (optional)" value={form.landmark} onChange={(v) => setForm({ ...form, landmark: v })} />
                <Field
                  label="Pincode"
                  value={form.pincode}
                  onChange={(v) => setForm({ ...form, pincode: v.replace(/\D/g, "").slice(0, 6) })}
                  error={touched.pincode ? errors.pincode : undefined}
                  onBlur={() => setTouched({ ...touched, pincode: true })}
                  inputMode="numeric"
                  maxLength={6}
                />
                <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} error={touched.city ? errors.city : undefined} onBlur={() => setTouched({ ...touched, city: true })} />
                <Field label="State" value={form.state} onChange={(v) => setForm({ ...form, state: v })} error={touched.state ? errors.state : undefined} onBlur={() => setTouched({ ...touched, state: true })} />
              </div>
              <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                />
                Make this my default delivery address
              </label>
              <div className="mt-4 flex gap-2">
                <Button type="submit" className="h-11 flex-1 rounded-full" disabled={save.isPending}>
                  {save.isPending ? "Saving…" : "Save address"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-full"
                  onClick={() => {
                    setOpen(false);
                    setEditingId(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>

        <aside className="h-fit lg:sticky lg:top-24">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Delivering your order
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Choose an address to see exact delivery charges and expected delivery dates for your{" "}
              {s.cart.count} item{s.cart.count === 1 ? "" : "s"}.
            </p>
            <Button
              className="mt-5 hidden h-12 w-full rounded-full lg:flex"
              disabled={!s.address}
              onClick={() => navigate({ to: "/checkout" })}
            >
              Continue to checkout
            </Button>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-40 border-t border-border bg-background px-4 py-3 lg:hidden">
        <Button
          className="h-12 w-full rounded-full text-base"
          disabled={!s.address}
          onClick={() => navigate({ to: "/checkout" })}
        >
          {s.address ? "Continue to checkout" : "Select an address"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  onBlur,
  inputMode,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  onBlur?: () => void;
  inputMode?: "text" | "numeric" | "tel" | "email";
  maxLength?: number;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        inputMode={inputMode}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        className={cn("mt-1 h-11", error && "border-destructive focus-visible:ring-destructive/40")}
      />
      {error && <p className="mt-1 text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
