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
import { saveShiprocketCredentials, testShiprocketConnection } from "@/lib/admin.functions";

export const Route = createFileRoute("/aurona-console-9f2x7k/shipping")({
  component: ShippingAdmin,
});

type Diagnostic = {
  stage: string;
  endpoint: string;
  method: string;
  status: number | null;
  ok: boolean;
  response: string;
};

function DiagnosticsPanel({ rows }: { rows: Diagnostic[] }) {
  if (!rows.length) return null;
  return (
    <div className="bg-slate-900 text-slate-100 rounded-xl p-4 text-xs font-mono space-y-2 overflow-x-auto">
      <div className="text-slate-400 uppercase tracking-wide">Developer diagnostics (secrets redacted)</div>
      {rows.map((d, i) => (
        <div key={i} className="border-t border-slate-700 pt-2">
          <div className={d.ok ? "text-emerald-400" : "text-rose-400"}>
            {d.ok ? "PASS" : "FAIL"} · {d.stage} · {d.method} {d.endpoint} · HTTP {d.status ?? "—"}
          </div>
          <div className="text-slate-300 whitespace-pre-wrap break-all">{d.response}</div>
        </div>
      ))}
    </div>
  );
}

function ShippingAdmin() {
  const qc = useQueryClient();
  const save = useServerFn(saveShiprocketCredentials);
  const retest = useServerFn(testShiprocketConnection);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", apiToken: "", pickupLocation: "", enabled: true });
  const [busy, setBusy] = useState(false);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);

  const { data } = useQuery({
    queryKey: ["admin-shipping"],
    queryFn: async () => {
      const { data } = await supabase.from("shipping_providers").select("provider, enabled, credential_masked, connected_at, last_verified_at, config_public").eq("provider", "shiprocket").maybeSingle();
      return data;
    },
  });

  const pub = (data?.config_public ?? {}) as { pickupLocation?: string; availablePickupLocations?: string[]; authMode?: string };

  const connect = async () => {
    if (!form.apiToken && (!form.email || !form.password)) {
      return toast.error("Enter the API user email and password, or paste an API token");
    }
    setBusy(true);
    setDiagnostics([]);
    try {
      const result = await save({ data: form });
      setDiagnostics((result.diagnostics ?? []) as Diagnostic[]);
      if (!result.ok) {
        toast.error(result.error, { duration: 14_000 });
        return;
      }
      if (result.warning) toast.warning(result.warning, { duration: 14_000 });
      else toast.success(`Shiprocket connected · pickup location "${result.pickupLocation}"`);

      setOpen(false);
      setForm({ email: "", password: "", apiToken: "", pickupLocation: "", enabled: true });
      await qc.invalidateQueries({ queryKey: ["admin-shipping"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Shiprocket connection failed");
    } finally {
      setBusy(false);
    }
  };

  const runTest = async () => {
    setBusy(true);
    setDiagnostics([]);
    try {
      const result = await retest({});
      setDiagnostics((result.diagnostics ?? []) as Diagnostic[]);
      if (!result.ok) toast.error(result.error, { duration: 14_000 });
      else if (result.warning) toast.warning(result.warning, { duration: 14_000 });
      else toast.success(`Connection healthy · pickup locations: ${result.pickupLocations?.join(", ") || "none"}`);

      await qc.invalidateQueries({ queryKey: ["admin-shipping"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Test failed");
    } finally {
      setBusy(false);
    }
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
        <p className="text-sm text-slate-500">Push confirmed orders to Shiprocket with one click, sync AWB &amp; tracking automatically.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2">
              <div className="font-semibold">Shiprocket</div>
              {data?.connected_at && <span className="text-xs bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Connected</span>}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {data?.connected_at
                ? <>Account: <code className="font-mono">{data.credential_masked}</code> · Auth: <code className="font-mono">{pub.authMode ?? "api_user"}</code> · Pickup: <code className="font-mono">{pub.pickupLocation}</code> · Last verified {data.last_verified_at ? new Date(data.last_verified_at).toLocaleString() : "—"}</>
                : "Not connected. Use your Shiprocket API user credentials, or paste an API token. Credentials are verified against Shiprocket and stored encrypted."}
            </div>
            {!!pub.availablePickupLocations?.length && (
              <div className="text-xs text-slate-500 mt-1">Pickup locations on the account: {pub.availablePickupLocations.join(", ")}</div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {data?.connected_at && (
              <>
                <label className="flex items-center gap-2 text-sm"><Switch checked={!!data.enabled} onCheckedChange={toggle} /> Enabled</label>
                <Button variant="outline" onClick={runTest} disabled={busy}>{busy ? "Testing…" : "Test connection"}</Button>
              </>
            )}
            <Button onClick={() => setOpen(true)}>{data?.connected_at ? "Reconnect" : "Connect"}</Button>
          </div>
        </div>
      </div>

      <DiagnosticsPanel rows={diagnostics} />

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700">
        <div className="font-semibold mb-1">How it works</div>
        Confirmed orders show a "Push to Shiprocket" button in the Orders admin. Tokens are refreshed automatically when they expire, and AWB + tracking URLs sync back to the customer's order tracking page.
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Connect Shiprocket</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>API user email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="username" /></div>
            <div><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="off" /></div>
            <div>
              <Label>API token (optional)</Label>
              <Input value={form.apiToken} onChange={(e) => setForm({ ...form, apiToken: e.target.value })} placeholder="Paste only if you use a static token" autoComplete="off" />
              <p className="text-xs text-slate-500 mt-1">If a token is provided it is used on its own — email/password login is skipped, so tokens and credentials are never mixed.</p>
            </div>
            <div><Label>Pickup location name (optional)</Label><Input value={form.pickupLocation} onChange={(e) => setForm({ ...form, pickupLocation: e.target.value })} placeholder="Leave blank to use the account's first location" /></div>
            <div className="text-xs text-slate-500 flex gap-2 items-start"><ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> AES-256 encrypted, never sent back to the browser. Verified with a live authenticated Shiprocket call before it is saved.</div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={connect} disabled={busy}>{busy ? "Verifying…" : "Verify & Connect"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
