import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Plug, ShoppingBag, Truck, CreditCard, MessageSquare, Percent, ShieldCheck,
  CheckCircle2, XCircle, Loader2, RefreshCw, Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listIntegrations, saveIntegration, testIntegration, syncWooEntity, wooImportStats,
} from "@/lib/integrations.functions";

export const Route = createFileRoute("/aurona-console-9f2x7k/integrations")({
  component: IntegrationsAdmin,
});

type Row = {
  provider: string;
  enabled: boolean;
  status: string;
  config_public: Record<string, unknown> | null;
  secret_masked: string | null;
  last_tested_at: string | null;
  last_test_message: string | null;
  last_sync_at: string | null;
  last_sync_summary: { entity?: string; fetched?: number; written?: number; note?: string } | null;
};

function IntegrationsAdmin() {
  const qc = useQueryClient();
  const load = useServerFn(listIntegrations);
  const save = useServerFn(saveIntegration);
  const test = useServerFn(testIntegration);
  const sync = useServerFn(syncWooEntity);
  const stats = useServerFn(wooImportStats);

  const { data: rows } = useQuery({
    queryKey: ["admin-integrations"],
    queryFn: async () => (await load({ data: {} as never })) as unknown as Row[],
  });
  const { data: importCounts } = useQuery({
    queryKey: ["admin-woo-import-stats"],
    queryFn: async () => (await stats({ data: {} as never })) as unknown as Record<string, number>,
  });

  const byProvider = useMemo(() => {
    const m: Record<string, Row> = {};
    (rows ?? []).forEach((r) => { m[r.provider] = r; });
    return m;
  }, [rows]);

  const [busy, setBusy] = useState<string | null>(null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-integrations"] });
    qc.invalidateQueries({ queryKey: ["admin-woo-import-stats"] });
  };

  const doSave = async (
    provider: string,
    enabled: boolean,
    publicConfig: Record<string, string | boolean | number>,
    secrets: Record<string, string>,
    maskSource?: string,
  ) => {
    setBusy(`save-${provider}`);
    try {
      await save({ data: { provider, enabled, publicConfig, secrets, maskSource } as never });
      toast.success("Credentials saved — stored encrypted, never shown again");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(null);
    }
  };

  const doTest = async (provider: string) => {
    setBusy(`test-${provider}`);
    try {
      const res = (await test({ data: { provider } as never })) as { ok: boolean; message: string };
      res.ok ? toast.success(res.message) : toast.error(res.message);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      setBusy(null);
    }
  };

  const doSync = async (entity: "products" | "orders" | "customers") => {
    setBusy(`sync-${entity}`);
    try {
      const res = (await sync({ data: { entity } as never })) as {
        ok: boolean; fetched: number; written: number; note?: string;
      };
      if (!res.ok) toast.error(res.note ?? "Sync failed");
      else toast.success(`${entity}: ${res.fetched} fetched, ${res.written} stored${res.note ? " — " + res.note : ""}`, { duration: 8000 });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Plug className="h-6 w-6 text-sky-600" /> Integrations
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Connect your store → enter API keys → test connection → import data. All secrets are encrypted
            with AES-256-GCM before storage and are never returned to the browser.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </header>

      <WooCard
        row={byProvider["woocommerce"]}
        counts={importCounts}
        busy={busy}
        onSave={doSave}
        onTest={doTest}
        onSync={doSync}
      />
      <ShiprocketCard row={byProvider["shiprocket"]} busy={busy} onSave={doSave} onTest={doTest} />
      <PaymentsCard rows={byProvider} busy={busy} onSave={doSave} onTest={doTest} />
      <SmsCard row={byProvider["sms"]} busy={busy} onSave={doSave} onTest={doTest} />
      <TaxShippingCard />
    </div>
  );
}

/* ---------------- shared UI ---------------- */

function Card({ icon: Icon, title, subtitle, badge, children }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; subtitle: string; badge?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-sky-600">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <div className="text-sm font-semibold">{title}</div>
            <div className="text-xs text-slate-500">{subtitle}</div>
          </div>
        </div>
        {badge}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function StatusBadge({ row }: { row?: Row }) {
  if (!row) return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">Not connected</span>;
  const connected = row.status === "connected";
  const error = row.status === "error";
  return (
    <div className="text-right">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        connected ? "bg-emerald-50 text-emerald-700" : error ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
      }`}>
        {connected ? <CheckCircle2 className="h-3.5 w-3.5" /> : error ? <XCircle className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
        {connected ? "Connected" : error ? "Connection error" : "Credentials saved"}
      </span>
      {row.last_test_message && (
        <div className="mt-1 max-w-xs text-[11px] leading-snug text-slate-500">{row.last_test_message}</div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", hint }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; hint?: string;
}) {
  return (
    <div>
      <Label className="text-xs text-slate-600">{label}</Label>
      <Input
        className="mt-1.5 h-11"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

type SaveFn = (
  provider: string, enabled: boolean,
  publicConfig: Record<string, string | boolean | number>,
  secrets: Record<string, string>, maskSource?: string,
) => Promise<void>;

function SaveRow({ provider, busy, enabled, setEnabled, onSave, onTest, extra }: {
  provider: string; busy: string | null; enabled: boolean; setEnabled: (v: boolean) => void;
  onSave: () => void; onTest: () => void; extra?: React.ReactNode;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
      <div className="flex items-center gap-2">
        <Switch checked={enabled} onCheckedChange={setEnabled} />
        <span className="text-xs text-slate-600">Enabled</span>
      </div>
      <Button size="sm" onClick={onSave} disabled={busy === `save-${provider}`}>
        {busy === `save-${provider}` && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save credentials
      </Button>
      <Button size="sm" variant="outline" onClick={onTest} disabled={busy === `test-${provider}`}>
        {busy === `test-${provider}` && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Test connection
      </Button>
      {extra}
    </div>
  );
}

/* ---------------- WooCommerce ---------------- */

function WooCard({ row, counts, busy, onSave, onTest, onSync }: {
  row?: Row; counts?: Record<string, number>; busy: string | null;
  onSave: SaveFn; onTest: (p: string) => void;
  onSync: (e: "products" | "orders" | "customers") => void;
}) {
  const pub = (row?.config_public ?? {}) as { storeUrl?: string; apiVersion?: string };
  const [storeUrl, setStoreUrl] = useState(pub.storeUrl ?? "");
  const [apiVersion, setApiVersion] = useState(pub.apiVersion ?? "v3");
  const [ck, setCk] = useState("");
  const [cs, setCs] = useState("");
  const [enabled, setEnabled] = useState(row?.enabled ?? true);
  const connected = row?.status === "connected";

  return (
    <Card
      icon={ShoppingBag}
      title="WooCommerce Store"
      subtitle="Pull products, orders and customers from your existing WordPress store"
      badge={<StatusBadge row={row} />}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Store URL" value={storeUrl} onChange={setStoreUrl} placeholder="https://aurona.in" hint="Root domain — /wp-json is added automatically" />
        <Field label="API Version" value={apiVersion} onChange={setApiVersion} placeholder="v3" />
        <Field label="Consumer Key" value={ck} onChange={setCk} placeholder={row?.secret_masked ? "•••• saved" : "ck_..."} hint="WooCommerce → Settings → Advanced → REST API" />
        <Field label="Consumer Secret" value={cs} onChange={setCs} type="password" placeholder={row?.secret_masked ? "•••• saved" : "cs_..."} hint="Leave blank to keep the saved value" />
      </div>

      <SaveRow
        provider="woocommerce"
        busy={busy}
        enabled={enabled}
        setEnabled={setEnabled}
        onSave={() => onSave("woocommerce", enabled, { storeUrl: storeUrl.trim(), apiVersion: apiVersion.trim() || "v3" }, { consumerKey: ck, consumerSecret: cs }, "consumerSecret")}
        onTest={() => onTest("woocommerce")}
      />

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">Import data</div>
          {row?.last_sync_at && (
            <div className="text-[11px] text-slate-500">
              Last sync {new Date(row.last_sync_at).toLocaleString()}
            </div>
          )}
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">
          Syncing only works while the old store and its REST API are still online. Products are written straight
          into the live catalogue; orders and customers are staged as legacy records first.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["products", "orders", "customers"] as const).map((e) => (
            <Button
              key={e}
              size="sm"
              variant="secondary"
              disabled={!connected || busy === `sync-${e}`}
              onClick={() => onSync(e)}
            >
              {busy === `sync-${e}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Sync {e}
            </Button>
          ))}
          {!connected && <span className="self-center text-[11px] text-amber-600">Test the connection first</span>}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-slate-600">
          <span>Imported products: <b>{counts?.["product"] ?? 0}</b></span>
          <span>Legacy orders: <b>{counts?.["order"] ?? 0}</b></span>
          <span>Legacy customers: <b>{counts?.["customer"] ?? 0}</b></span>
        </div>
        {row?.last_sync_summary?.note && (
          <p className="mt-2 text-[11px] text-slate-500">{row.last_sync_summary.note}</p>
        )}
      </div>
    </Card>
  );
}

/* ---------------- Shiprocket ---------------- */

function ShiprocketCard({ row, busy, onSave, onTest }: {
  row?: Row; busy: string | null; onSave: SaveFn; onTest: (p: string) => void;
}) {
  const pub = (row?.config_public ?? {}) as { pickupLocation?: string; channelId?: string };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [pickup, setPickup] = useState(pub.pickupLocation ?? "Primary");
  const [enabled, setEnabled] = useState(row?.enabled ?? true);

  return (
    <Card
      icon={Truck}
      title="Shiprocket"
      subtitle="Order sync, shipment creation and AWB tracking"
      badge={<StatusBadge row={row} />}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Email / Username" value={email} onChange={setEmail} placeholder={row?.secret_masked ? "•••• saved" : "ops@aurona.in"} />
        <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="Leave blank to keep saved" />
        <Field label="API Token (optional)" value={apiToken} onChange={setApiToken} type="password" hint="Use instead of email/password if you generated a token" />
        <Field label="Pickup Location" value={pickup} onChange={setPickup} placeholder="Primary" />
      </div>
      <SaveRow
        provider="shiprocket"
        busy={busy}
        enabled={enabled}
        setEnabled={setEnabled}
        onSave={() => onSave("shiprocket", enabled, { pickupLocation: pickup.trim() || "Primary" }, { email, password, apiToken }, "password")}
        onTest={() => onTest("shiprocket")}
      />
      <p className="mt-3 text-[11px] text-slate-500">
        Shipment creation and tracking for individual orders live in <b>Orders → order detail → Push to Shiprocket</b>.
      </p>
    </Card>
  );
}

/* ---------------- Payments ---------------- */

function PaymentsCard({ rows, busy, onSave, onTest }: {
  rows: Record<string, Row>; busy: string | null; onSave: SaveFn; onTest: (p: string) => void;
}) {
  const rz = rows["razorpay"];
  const st = rows["stripe"];
  const pp = rows["phonepe"];

  const [rzId, setRzId] = useState(((rz?.config_public ?? {}) as { keyId?: string }).keyId ?? "");
  const [rzSecret, setRzSecret] = useState("");
  const [rzHook, setRzHook] = useState("");
  const [rzMode, setRzMode] = useState(((rz?.config_public ?? {}) as { mode?: string }).mode ?? "test");
  const [rzOn, setRzOn] = useState(rz?.enabled ?? true);

  const [stPub, setStPub] = useState(((st?.config_public ?? {}) as { publishableKey?: string }).publishableKey ?? "");
  const [stSecret, setStSecret] = useState("");
  const [stHook, setStHook] = useState("");
  const [stOn, setStOn] = useState(st?.enabled ?? false);

  const ppPub = (pp?.config_public ?? {}) as { merchantId?: string; saltIndex?: string; env?: string };
  const [ppMid, setPpMid] = useState(ppPub.merchantId ?? "");
  const [ppSalt, setPpSalt] = useState("");
  const [ppIdx, setPpIdx] = useState(ppPub.saltIndex ?? "1");
  const [ppEnv, setPpEnv] = useState(ppPub.env ?? "sandbox");
  const [ppOn, setPpOn] = useState(pp?.enabled ?? false);

  return (
    <Card icon={CreditCard} title="Payment Gateways" subtitle="Razorpay, Stripe and PhonePe" badge={<StatusBadge row={rz} />}>
      <div className="space-y-8">
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Razorpay</div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Key ID" value={rzId} onChange={setRzId} placeholder="rzp_live_..." />
            <Field label="Key Secret" value={rzSecret} onChange={setRzSecret} type="password" placeholder={rz?.secret_masked ?? "Leave blank to keep saved"} />
            <Field label="Webhook Secret" value={rzHook} onChange={setRzHook} type="password" />
            <Field label="Mode (test / live)" value={rzMode} onChange={setRzMode} placeholder="test" />
          </div>
          <SaveRow provider="razorpay" busy={busy} enabled={rzOn} setEnabled={setRzOn}
            onSave={() => onSave("razorpay", rzOn, { keyId: rzId.trim(), mode: rzMode.trim() || "test" }, { keyId: rzId, keySecret: rzSecret, webhookSecret: rzHook }, "keySecret")}
            onTest={() => onTest("razorpay")} />
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
            Stripe <StatusBadge row={st} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Publishable Key" value={stPub} onChange={setStPub} placeholder="pk_live_..." />
            <Field label="Secret Key" value={stSecret} onChange={setStSecret} type="password" placeholder={st?.secret_masked ?? "sk_live_..."} />
            <Field label="Webhook Secret" value={stHook} onChange={setStHook} type="password" placeholder="whsec_..." />
          </div>
          <SaveRow provider="stripe" busy={busy} enabled={stOn} setEnabled={setStOn}
            onSave={() => onSave("stripe", stOn, { publishableKey: stPub.trim() }, { publishableKey: stPub, secretKey: stSecret, webhookSecret: stHook }, "secretKey")}
            onTest={() => onTest("stripe")} />
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
            PhonePe <StatusBadge row={pp} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Merchant ID" value={ppMid} onChange={setPpMid} placeholder="AURONAONLINE" />
            <Field label="Salt Key" value={ppSalt} onChange={setPpSalt} type="password" placeholder={pp?.secret_masked ?? "Leave blank to keep saved"} />
            <Field label="Salt Index" value={ppIdx} onChange={setPpIdx} placeholder="1" />
            <Field label="Environment (sandbox / production)" value={ppEnv} onChange={setPpEnv} placeholder="sandbox" />
          </div>
          <SaveRow provider="phonepe" busy={busy} enabled={ppOn} setEnabled={setPpOn}
            onSave={() => onSave("phonepe", ppOn, { merchantId: ppMid.trim(), saltIndex: ppIdx.trim() || "1", env: ppEnv.trim() || "sandbox" }, { saltKey: ppSalt }, "saltKey")}
            onTest={() => onTest("phonepe")} />
        </div>
      </div>
    </Card>
  );
}

/* ---------------- SMS / OTP ---------------- */

function SmsCard({ row, busy, onSave, onTest }: {
  row?: Row; busy: string | null; onSave: SaveFn; onTest: (p: string) => void;
}) {
  const pub = (row?.config_public ?? {}) as {
    providerName?: string; senderId?: string; otpLength?: string; otpExpiryMinutes?: string;
  };
  const [providerName, setProviderName] = useState(pub.providerName ?? "msg91");
  const [senderId, setSenderId] = useState(pub.senderId ?? "AURONA");
  const [otpLength, setOtpLength] = useState(pub.otpLength ?? "6");
  const [expiry, setExpiry] = useState(pub.otpExpiryMinutes ?? "10");
  const [apiKey, setApiKey] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [enabled, setEnabled] = useState(row?.enabled ?? false);

  return (
    <Card icon={MessageSquare} title="SMS & OTP" subtitle="MSG91 or Twilio for login OTP and order alerts" badge={<StatusBadge row={row} />}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Provider (msg91 / twilio)" value={providerName} onChange={setProviderName} />
        <Field label="Sender ID" value={senderId} onChange={setSenderId} placeholder="AURONA" />
        <Field label="API Key / Auth Key / Account SID" value={apiKey} onChange={setApiKey} type="password" placeholder={row?.secret_masked ?? "Leave blank to keep saved"} />
        <Field label="Auth Token (Twilio only)" value={authToken} onChange={setAuthToken} type="password" />
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <div><b className="text-foreground">Active MSG91 Flow:</b> 67978567d6fc0554473309a4 (Delivered)</div>
          <div className="mt-1"><b className="text-foreground">Mapped DLT template:</b> 1007630933578375890 · sender AURONA</div>
          <div className="mt-1">Flow 6a7826ee25e4a56c84021ea2 fails with "Template Id not found on DLT" — its DLT id is saved as 107743677006426433 instead of 1077436770064246433. Fix in MSG91, then switch.</div>
        </div>


        <div className="grid grid-cols-2 gap-4">
          <Field label="OTP length" value={otpLength} onChange={setOtpLength} />
          <Field label="Expiry (minutes)" value={expiry} onChange={setExpiry} />
        </div>
      </div>
      <SaveRow provider="sms" busy={busy} enabled={enabled} setEnabled={setEnabled}
        onSave={() => onSave("sms", enabled, {
          providerName: providerName.trim().toLowerCase(), senderId: senderId.trim(),
          otpLength: otpLength.trim(), otpExpiryMinutes: expiry.trim(),
        }, { apiKey, authToken }, "apiKey")}
        onTest={() => onTest("sms")} />
    </Card>
  );
}

/* ---------------- Tax & Shipping ---------------- */

function TaxShippingCard() {
  const qc = useQueryClient();
  const { data: tax } = useQuery({
    queryKey: ["admin-tax-rules"],
    queryFn: async () => (await supabase.from("tax_rules").select("*").order("created_at")).data ?? [],
  });
  const { data: zones } = useQuery({
    queryKey: ["admin-shipping-zones"],
    queryFn: async () => (await supabase.from("shipping_zones").select("*").order("sort_order")).data ?? [],
  });

  const patchTax = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("tax_rules").update(patch as never).eq("id", id);
    error ? toast.error(error.message) : qc.invalidateQueries({ queryKey: ["admin-tax-rules"] });
  };
  const patchZone = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("shipping_zones").update(patch as never).eq("id", id);
    error ? toast.error(error.message) : qc.invalidateQueries({ queryKey: ["admin-shipping-zones"] });
  };

  return (
    <Card icon={Percent} title="Tax & Shipping Rules" subtitle="GST slabs, shipping zones and delivery rules">
      <div className="space-y-7">
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-600">GST rules</div>
          <div className="space-y-2">
            {(tax ?? []).map((t) => (
              <div key={t.id} className="grid items-center gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[1.6fr_1fr_.8fr_1fr_auto]">
                <div className="text-sm font-medium">{t.name}</div>
                <Input className="h-9" defaultValue={t.hsn_code ?? ""} placeholder="HSN"
                  onBlur={(e) => patchTax(t.id, { hsn_code: e.target.value || null })} />
                <Input className="h-9" defaultValue={String(t.gst_percent)} placeholder="GST %"
                  onBlur={(e) => patchTax(t.id, { gst_percent: Number(e.target.value) || 0 })} />
                <Input className="h-9" defaultValue={t.applies_to} placeholder="applies to"
                  onBlur={(e) => patchTax(t.id, { applies_to: e.target.value })} />
                <Switch checked={t.active} onCheckedChange={(v) => patchTax(t.id, { active: v })} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Shipping zones</div>
          <div className="space-y-2">
            {(zones ?? []).map((z) => (
              <div key={z.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">{z.name}</div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    COD <Switch checked={z.cod_allowed} onCheckedChange={(v) => patchZone(z.id, { cod_allowed: v })} />
                    Active <Switch checked={z.active} onCheckedChange={(v) => patchZone(z.id, { active: v })} />
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <Label className="text-[11px] text-slate-500">Flat rate (₹)</Label>
                    <Input className="mt-1 h-9" defaultValue={String(z.flat_rate)}
                      onBlur={(e) => patchZone(z.id, { flat_rate: Number(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label className="text-[11px] text-slate-500">Free above (₹)</Label>
                    <Input className="mt-1 h-9" defaultValue={z.free_above == null ? "" : String(z.free_above)}
                      onBlur={(e) => patchZone(z.id, { free_above: e.target.value === "" ? null : Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label className="text-[11px] text-slate-500">Min days</Label>
                    <Input className="mt-1 h-9" defaultValue={String(z.min_days)}
                      onBlur={(e) => patchZone(z.id, { min_days: Number(e.target.value) || 1 })} />
                  </div>
                  <div>
                    <Label className="text-[11px] text-slate-500">Max days</Label>
                    <Input className="mt-1 h-9" defaultValue={String(z.max_days)}
                      onBlur={(e) => patchZone(z.id, { max_days: Number(e.target.value) || 1 })} />
                  </div>
                </div>
                {z.states?.length > 0 && (
                  <p className="mt-2 text-[11px] text-slate-500">States: {z.states.join(", ")}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
