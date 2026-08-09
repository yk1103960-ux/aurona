import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreditCard, ShieldCheck, Zap } from "lucide-react";
import { toast } from "sonner";
import { saveRazorpayCredentials, setRazorpayEnabled } from "@/lib/admin.functions";

export const Route = createFileRoute("/aurona-console-9f2x7k/payments")({
  component: PaymentsAdmin,
});

function PaymentsAdmin() {
  const qc = useQueryClient();
  const save = useServerFn(saveRazorpayCredentials);
  const toggle = useServerFn(setRazorpayEnabled);
  const [connectOpen, setConnectOpen] = useState(false);
  const [form, setForm] = useState({ keyId: "", keySecret: "", webhookSecret: "", mode: "test" as "test" | "live", enabled: true });
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const { data } = await supabase.from("payment_gateways").select("provider, enabled, mode, secret_last4, connected_at, config_public").order("provider");
      return data ?? [];
    },
  });

  const razorpay = data?.find(d => d.provider === "razorpay");
  const cod = data?.find(d => d.provider === "cod");

  const connect = async () => {
    if (!form.keyId || !form.keySecret) return toast.error("Key ID and secret required");
    setBusy(true);
    try {
      await save({ data: form });
      toast.success("Razorpay connected — credentials stored securely");
      setConnectOpen(false);
      setForm({ keyId: "", keySecret: "", webhookSecret: "", mode: "test", enabled: true });
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  const toggleRzp = async (enabled: boolean) => {
    try {
      await toggle({ data: { enabled } });
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
    } catch (e: any) { toast.error(e.message); }
  };

  const setCodEnabled = async (enabled: boolean) => {
    const { error } = await supabase.from("payment_gateways").update({ enabled }).eq("provider", "cod");
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-payments"] });
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><CreditCard className="w-6 h-6" /> Payment Gateways</h1>
        <p className="text-sm text-slate-500">Credentials never leave the server. Only the last 4 characters are shown.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="font-semibold">Razorpay</div>
              {razorpay?.connected_at && <span className="text-xs bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Connected</span>}
              {razorpay?.mode && <span className="text-xs bg-slate-100 rounded-full px-2 py-0.5 capitalize">{razorpay.mode}</span>}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {razorpay?.connected_at
                ? <>Key ID <code className="font-mono">{(razorpay.config_public as any)?.keyId?.slice(0, 12)}…</code> · Secret <code className="font-mono">{razorpay.secret_last4}</code></>
                : "Not connected. Click Connect to paste keys — they will be encrypted and stored server-side."}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {razorpay?.connected_at && (
              <label className="flex items-center gap-2 text-sm"><Switch checked={razorpay.enabled} onCheckedChange={toggleRzp} /> Enabled</label>
            )}
            <Button onClick={() => setConnectOpen(true)}>{razorpay?.connected_at ? "Reconnect" : "Connect"}</Button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold flex items-center gap-2">Cash on Delivery <Zap className="w-4 h-4 text-amber-500" /></div>
            <div className="text-xs text-slate-500 mt-1">Built-in method. No external credentials required.</div>
          </div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={!!cod?.enabled} onCheckedChange={setCodEnabled} /> Enabled</label>
        </div>
      </div>

      <PhonePeDiagnostics />

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900">
        <div className="font-semibold mb-1">Webhook URL</div>
        Configure in your Razorpay dashboard → Settings → Webhooks:<br/>
        <code className="font-mono bg-white px-2 py-1 rounded mt-1 inline-block">{typeof window !== "undefined" ? window.location.origin : ""}/api/public/razorpay-webhook</code>
        <br/>Subscribe to <code>payment.captured</code>. Paste the same webhook secret in the form above.
      </div>


      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Connect Razorpay</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Mode</Label>
              <Select value={form.mode} onValueChange={(v: any) => setForm({ ...form, mode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="test">Test</SelectItem><SelectItem value="live">Live</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Key ID</Label><Input value={form.keyId} onChange={(e) => setForm({ ...form, keyId: e.target.value })} placeholder="rzp_test_..." autoComplete="off" /></div>
            <div><Label>Key Secret</Label><Input type="password" value={form.keySecret} onChange={(e) => setForm({ ...form, keySecret: e.target.value })} autoComplete="off" /></div>
            <div><Label>Webhook Secret (optional)</Label><Input type="password" value={form.webhookSecret} onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })} autoComplete="off" /></div>
            <div className="text-xs text-slate-500 flex gap-2 items-start"><ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> Values are AES-256 encrypted before storage. They are never re-displayed anywhere in the admin panel.</div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setConnectOpen(false)}>Cancel</Button><Button onClick={connect} disabled={busy}>{busy ? "Saving…" : "Save & Connect"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
