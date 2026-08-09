import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Plus, Star, Trash2, X } from "lucide-react";

export type AddressRow = {
  id: string;
  label: string | null;
  full_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
};

const EMPTY = {
  label: "Home",
  full_name: "",
  phone: "",
  line1: "",
  line2: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
};

export function AddressManager({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });

  const list = useQuery({
    queryKey: ["addresses", userId],
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

  const invalidate = () => qc.invalidateQueries({ queryKey: ["addresses"] });

  const save = useMutation({
    mutationFn: async () => {
      if (!/^\d{6}$/.test(form.pincode)) throw new Error("Enter a valid 6-digit pincode");
      if (!/^\d{10}$/.test(form.phone.replace(/\D/g, "").slice(-10))) throw new Error("Enter a valid 10-digit phone");
      const { error } = await supabase.from("addresses").insert({
        user_id: userId,
        label: form.label.trim() || null,
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        line1: form.line1.trim(),
        line2: form.line2.trim() || null,
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        is_default: (list.data ?? []).length === 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setOpen(false);
      setForm({ ...EMPTY });
      toast.success("Address saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("addresses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Address removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const makeDefault = useMutation({
    mutationFn: async (id: string) => {
      const { error: clear } = await supabase.from("addresses").update({ is_default: false }).eq("user_id", userId);
      if (clear) throw clear;
      const { error } = await supabase.from("addresses").update({ is_default: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Default address updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = list.data ?? [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-display text-2xl">Saved addresses</h2>
          <p className="mt-1 text-sm text-muted-foreground">Delivery addresses used at checkout.</p>
        </div>
        <Button onClick={() => setOpen((v) => !v)} className="gap-2 rounded-full">
          {open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {open ? "Cancel" : "Add address"}
        </Button>
      </div>

      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="mt-5 grid gap-3 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-2"
        >
          <F label="Label" v={form.label} set={(v) => setForm({ ...form, label: v })} />
          <F label="Full name" v={form.full_name} set={(v) => setForm({ ...form, full_name: v })} required />
          <F label="Phone" v={form.phone} set={(v) => setForm({ ...form, phone: v })} required />
          <F label="Pincode" v={form.pincode} set={(v) => setForm({ ...form, pincode: v.replace(/\D/g, "").slice(0, 6) })} required />
          <div className="sm:col-span-2">
            <F label="Address line 1" v={form.line1} set={(v) => setForm({ ...form, line1: v })} required />
          </div>
          <div className="sm:col-span-2">
            <F label="Address line 2 (optional)" v={form.line2} set={(v) => setForm({ ...form, line2: v })} />
          </div>
          <F label="City" v={form.city} set={(v) => setForm({ ...form, city: v })} required />
          <F label="State" v={form.state} set={(v) => setForm({ ...form, state: v })} required />
          <div className="sm:col-span-2">
            <Button type="submit" disabled={save.isPending} className="mt-1 h-11 w-full rounded-full">
              {save.isPending ? "Saving…" : "Save address"}
            </Button>
          </div>
        </form>
      )}

      {list.isLoading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl border border-border bg-surface" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-10 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-border bg-background">
            <MapPin className="h-6 w-6 text-primary" strokeWidth={1.4} />
          </div>
          <div className="text-display text-2xl">No addresses saved</div>
          <p className="mt-2 text-sm text-muted-foreground">Add an address for faster one-tap checkout.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {rows.map((a) => (
            <div key={a.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{a.label || "Address"}</span>
                {a.is_default && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                    Default
                  </span>
                )}
              </div>
              <div className="mt-2 text-sm font-semibold">{a.full_name}</div>
              <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />
                {a.city}, {a.state} — {a.pincode}<br />
                {a.phone}
              </div>
              <div className="mt-4 flex items-center gap-3">
                {!a.is_default && (
                  <button
                    onClick={() => makeDefault.mutate(a.id)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary"
                  >
                    <Star className="h-3.5 w-3.5" /> Set default
                  </button>
                )}
                <button
                  onClick={() => remove.mutate(a.id)}
                  className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function F({
  label,
  v,
  set,
  required,
}: {
  label: string;
  v: string;
  set: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={v} onChange={(e) => set(e.target.value)} required={required} className="mt-1 h-11" />
    </div>
  );
}
