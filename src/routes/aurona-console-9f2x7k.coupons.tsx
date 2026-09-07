import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit3, Ticket } from "lucide-react";
import { toast } from "sonner";
import { inr } from "@/lib/format";
import { adminArchiveCoupon, adminSaveCoupon } from "@/lib/coupon-admin.functions";

export const Route = createFileRoute("/aurona-console-9f2x7k/coupons")({
  component: CouponsAdmin,
});

/** Local "YYYY-MM-DDTHH:mm" from the picker → absolute UTC timestamp. */
function toIso(v?: string | null) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
/** Stored timestamp → local value the datetime picker expects. */
function toLocalInput(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

type Coupon = {
  id: string;
  code: string;
  description: string | null;
  type: "flat" | "percentage";
  value: number;
  min_order_value: number;
  max_discount: number | null;
  starts_at: string | null;
  expires_at: string | null;
  usage_limit: number | null;
  per_user_limit: number;
  eligible_roles: string[];
  times_used: number;
  active: boolean;
};

function CouponsAdmin() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Coupon> | null>(null);
  const saveCoupon = useServerFn(adminSaveCoupon);
  const archiveCoupon = useServerFn(adminArchiveCoupon);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("coupons").select("*").is("archived_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Coupon[];
    },
  });

  const save = async () => {
    if (!editing?.code || !editing.type || !(Number(editing.value) > 0))
      return toast.error("Code, type and value required");
    const payload = {
      id: editing.id,
      code: editing.code.trim().toUpperCase(),
      description: editing.description ?? null,
      type: editing.type,
      value: Number(editing.value),
      min_order_value: Number(editing.min_order_value ?? 0),
      max_discount: editing.max_discount ? Number(editing.max_discount) : null,
      starts_at: toIso(editing.starts_at),
      expires_at: toIso(editing.expires_at),
      usage_limit: editing.usage_limit ? Number(editing.usage_limit) : null,
      per_user_limit: Number(editing.per_user_limit ?? 1),
      eligible_roles: editing.eligible_roles?.length ? editing.eligible_roles : ["customer", "retailer", "distributor"],
      active: editing.active ?? true,
    };
    try {
      await saveCoupon({ data: payload as any });
      toast.success("Coupon saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
    } catch (error: any) {
      toast.error(error?.message || "Could not save coupon");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Archive this coupon? It will stop working but its order history will be preserved.")) return;
    try {
      await archiveCoupon({ data: { id } });
      toast.success("Coupon archived");
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
    } catch (error: any) {
      toast.error(error?.message || "Could not archive coupon");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Coupons & Offers</h1>
          <p className="text-sm text-slate-500">Discount codes with usage limits, role targeting and validity windows.</p>
        </div>
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing({ type: "percentage", value: 10, per_user_limit: 1, active: true, eligible_roles: ["customer","retailer","distributor"] })}>
              <Plus className="w-4 h-4 mr-1" /> New coupon
            </Button>
          </DialogTrigger>
          <CouponDialog editing={editing} setEditing={setEditing} save={save} />
        </Dialog>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-4 py-3">Code</th>
              <th className="text-left px-4 py-3">Discount</th>
              <th className="text-left px-4 py-3">Min order</th>
              <th className="text-left px-4 py-3">Uses</th>
              <th className="text-left px-4 py-3">Roles</th>
              <th className="text-left px-4 py-3">Active</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">Loading…</td></tr>}
            {data?.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500"><Ticket className="w-10 h-10 mx-auto mb-2 text-slate-300" />No coupons yet.</td></tr>}
            {data?.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono font-semibold">{c.code}</td>
                <td className="px-4 py-3">{c.type === "flat" ? inr(c.value) : `${c.value}%`}{c.max_discount ? ` (max ${inr(c.max_discount)})` : ""}</td>
                <td className="px-4 py-3">{inr(c.min_order_value)}</td>
                <td className="px-4 py-3">{c.times_used}{c.usage_limit ? ` / ${c.usage_limit}` : ""}</td>
                <td className="px-4 py-3 text-xs">{c.eligible_roles.join(", ")}</td>
                <td className="px-4 py-3">{c.active ? <span className="text-emerald-600">Active</span> : <span className="text-slate-400">Inactive</span>}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="icon" variant="ghost" aria-label={`Edit coupon ${c.code}`} onClick={() => setEditing(c)}><Edit3 className="w-4 h-4" /></Button>
                  <Button size="icon" variant="destructive" aria-label={`Archive coupon ${c.code}`} onClick={() => remove(c.id)}><Trash2 className="w-4 h-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CouponDialog({ editing, setEditing, save }: { editing: Partial<Coupon> | null; setEditing: (v: Partial<Coupon> | null) => void; save: () => void; }) {
  if (!editing) return null;
  const set = (k: keyof Coupon, v: any) => setEditing({ ...editing, [k]: v });
  const roles = editing.eligible_roles ?? [];
  const toggleRole = (r: string) => set("eligible_roles", roles.includes(r) ? roles.filter(x => x !== r) : [...roles, r]);
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{editing.id ? "Edit coupon" : "New coupon"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Code</Label><Input value={editing.code ?? ""} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="AURONA10" /></div>
          <div><Label>Type</Label>
            <Select value={editing.type} onValueChange={(v) => set("type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="percentage">Percentage %</SelectItem><SelectItem value="flat">Flat ₹</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Value</Label><Input type="number" value={editing.value ?? ""} onChange={(e) => set("value", e.target.value)} /></div>
          <div><Label>Max discount (₹)</Label><Input type="number" value={editing.max_discount ?? ""} onChange={(e) => set("max_discount", e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Min order (₹)</Label><Input type="number" value={editing.min_order_value ?? 0} onChange={(e) => set("min_order_value", e.target.value)} /></div>
          <div><Label>Per-user limit</Label><Input type="number" value={editing.per_user_limit ?? 1} onChange={(e) => set("per_user_limit", e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Total usage cap</Label><Input type="number" value={editing.usage_limit ?? ""} onChange={(e) => set("usage_limit", e.target.value)} placeholder="Unlimited" /></div>
          <div className="flex items-end pb-2 text-xs text-slate-500">Leave blank for unlimited total uses.</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Starts at</Label><Input type="datetime-local" value={toLocalInput(editing.starts_at)} onChange={(e) => set("starts_at", e.target.value)} /></div>
          <div><Label>Expires at</Label><Input type="datetime-local" value={toLocalInput(editing.expires_at)} onChange={(e) => set("expires_at", e.target.value)} /></div>
        </div>
        <div><Label>Description</Label><Textarea value={editing.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={2} /></div>
        <div>
          <Label>Eligible for</Label>
          <div className="flex gap-4 mt-1 text-sm">
            {["customer","retailer","distributor"].map(r => (
              <label key={r} className="flex items-center gap-2">
                <input type="checkbox" checked={roles.includes(r)} onChange={() => toggleRole(r)} /> {r}
              </label>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2"><Switch checked={editing.active ?? true} onCheckedChange={(v) => set("active", v)} /> Active</label>
      </div>
      <DialogFooter><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
    </DialogContent>
  );
}
