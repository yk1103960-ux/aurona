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
import { listPaymentDiagnostics, testPhonePeConfiguration } from "@/lib/payments-admin.functions";
import { Activity, AlertTriangle } from "lucide-react";

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

function PhonePeDiagnostics() {
  const runTest = useServerFn(testPhonePeConfiguration);
  const listEvents = useServerFn(listPaymentDiagnostics);
  const [result, setResult] = useState<Awaited<ReturnType<typeof runTest>> | null>(null);
  const [testing, setTesting] = useState(false);

  const { data: events, refetch } = useQuery({
    queryKey: ["payment-diagnostics"],
    queryFn: () => listEvents({ data: { limit: 15 } }),
  });

  const run = async () => {
    setTesting(true);
    try {
      const r = await runTest({ data: undefined });
      setResult(r);
      r.ok ? toast.success("PhonePe configuration verified") : toast.error("PhonePe configuration problem detected");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Test failed");
    }
    setTesting(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-semibold flex items-center gap-2"><Activity className="w-4 h-4" /> PhonePe diagnostics</div>
          <div className="text-xs text-slate-500 mt-1">Creates a ₹1 payment <em>session</em> to verify credentials, environment and checkout ring. No money is charged.</div>
        </div>
        <Button onClick={run} disabled={testing}>{testing ? "Testing…" : "Test Payment Configuration"}</Button>
      </div>

      {result && (
        <div className={`rounded-lg border p-4 text-xs space-y-1 ${result.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
          <div className="font-semibold flex items-center gap-2">
            {result.ok ? "Status: Connected" : <><AlertTriangle className="w-4 h-4" /> Status: Error</>}
          </div>
          <div>API: {result.api ?? "—"}</div>
          <div>Environment: <span className="font-mono">{result.environment ?? "—"}</span></div>
          <div>Merchant reference: <span className="font-mono">{result.merchantRef ?? "—"}</span></div>
          <div>Stage: {result.stage}</div>
          <div>HTTP status: {result.httpStatus ?? "—"}</div>
          <div>Checkout host: <span className="font-mono">{result.checkoutHost ?? "—"}</span> {result.ring ? `(${result.ring} ring)` : ""}</div>
          <div>Transaction ID: <span className="font-mono">{result.txnId ?? "—"}</span></div>
          <div>Last test: {new Date(result.testedAt).toLocaleString()}</div>
          <div className="pt-1">Provider message: {result.message}</div>
        </div>
      )}

      <div>
        <div className="text-xs font-semibold text-slate-600 mb-2">Recent payment events (sanitised)</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-500 text-left">
              <tr><th className="py-1 pr-3">When</th><th className="pr-3">Stage</th><th className="pr-3">Env</th><th className="pr-3">HTTP</th><th className="pr-3">State</th><th className="pr-3">Host</th><th className="pr-3">Txn</th><th>Message</th></tr>
            </thead>
            <tbody>
              {(events ?? []).map((e: any) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="py-1 pr-3 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="pr-3">{e.stage}</td>
                  <td className="pr-3">{e.environment ?? "—"}</td>
                  <td className={`pr-3 ${e.ok ? "text-emerald-600" : "text-red-600"}`}>{e.http_status ?? "—"}</td>
                  <td className="pr-3">{e.payment_state ?? "—"}</td>
                  <td className="pr-3 font-mono">{e.checkout_host ?? "—"}</td>
                  <td className="pr-3 font-mono">{e.merchant_txn_id ?? "—"}</td>
                  <td className="text-slate-500">{e.provider_code ? `${e.provider_code}: ` : ""}{e.provider_message ?? ""}</td>
                </tr>
              ))}
              {(events ?? []).length === 0 && <tr><td colSpan={8} className="py-3 text-slate-400">No payment attempts recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
