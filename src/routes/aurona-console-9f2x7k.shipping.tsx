import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Truck, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { saveShiprocketCredentials } from "@/lib/admin.functions";

export const Route = createFileRoute("/aurona-console-9f2x7k/shipping")({
  component: ShippingAdmin,
});

function ShippingAdmin() {
  const qc = useQueryClient();
  const save = useServerFn(saveShiprocketCredentials);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", pickupLocation: "Primary", enabled: true });
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["admin-shipping"],
    queryFn: async () => {
      const { data } = await supabase.from("shipping_providers").select("provider, enabled, credential_masked, connected_at, last_verified_at, config_public").eq("provider", "shiprocket").maybeSingle();
      return data;
    },
  });

  const connect = async () => {
    if (!form.email || !form.password) return toast.error("Email and password required");
    setBusy(true);
    try {
      await save({ data: form });
      toast.success("Shiprocket connected & verified");
      setOpen(false);
      setForm({ email: "", password: "", pickupLocation: "Primary", enabled: true });
      qc.invalidateQueries({ queryKey: ["admin-shipping"] });
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  const toggle = async (enabled: boolean) => {
    const { error } = await supabase.from("shipping_providers").update({ enabled }).eq("provider", "shiprocket");
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-shipping"] });
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Truck className="w-6 h-6" /> Shipping</h1>
        <p className="text-sm text-slate-500">Push confirmed orders to Shiprocket with one click, sync AWB & tracking automatically.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="font-semibold">Shiprocket</div>
              {data?.connected_at && <span className="text-xs bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Connected</span>}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {data?.connected_at
                ? <>Account: <code className="font-mono">{data.credential_masked}</code> · Pickup: <code className="font-mono">{(data.config_public as any)?.pickupLocation}</code> · Last verified {data.last_verified_at ? new Date(data.last_verified_at).toLocaleString() : "—"}</>
                : "Not connected. Credentials are verified against Shiprocket immediately and stored encrypted."}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {data?.connected_at && (
              <label className="flex items-center gap-2 text-sm"><Switch checked={!!data.enabled} onCheckedChange={toggle} /> Enabled</label>
            )}
            <Button onClick={() => setOpen(true)}>{data?.connected_at ? "Reconnect" : "Connect"}</Button>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700">
        <div className="font-semibold mb-1">How it works</div>
        Confirmed orders show a "Push to Shiprocket" button in the Orders admin. AWB and tracking URLs sync back automatically and appear on the customer's order tracking page.
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Connect Shiprocket</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Shiprocket email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" /></div>
            <div><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="off" /></div>
            <div><Label>Pickup location name</Label><Input value={form.pickupLocation} onChange={(e) => setForm({ ...form, pickupLocation: e.target.value })} placeholder="Primary" /></div>
            <div className="text-xs text-slate-500 flex gap-2 items-start"><ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> AES-256 encrypted. Verified against Shiprocket before saving; never re-displayed in the admin panel.</div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={connect} disabled={busy}>{busy ? "Verifying…" : "Verify & Connect"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
