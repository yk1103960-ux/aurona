import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  adminAffiliateOverview,
  adminCreateAffiliate,
  adminSaveAffiliateSettings,
  adminSetCommissionStatus,
  adminSetWithdrawalStatus,
  adminUpdateAffiliate,
} from "@/lib/affiliate.functions";

export const Route = createFileRoute("/aurona-console-9f2x7k/affiliates")({
  head: () => ({ meta: [{ title: "Affiliates | Aurona Console" }] }),
  component: AffiliatesAdmin,
});

const TABS = [
  "Overview",
  "Analytics",
  "Affiliates",
  "Referrals",
  "Products",
  "Commissions",
  "Payout details",
  "Withdrawals",
  "Configuration",
  "Logs",
] as const;
type Tab = (typeof TABS)[number];

function AffiliatesAdmin() {
  const qc = useQueryClient();
  const overviewFn = useServerFn(adminAffiliateOverview);
  const [tab, setTab] = useState<Tab>("Overview");
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-affiliates"],
    queryFn: () => overviewFn({}),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-affiliates"] });

  if (isLoading)
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading affiliate data…
      </div>
    );
  if (error || !data)
    return <div className="p-6 text-sm text-destructive">Could not load affiliate data.</div>;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Affiliate program</h1>
        <p className="text-sm text-muted-foreground">
          Registrations, attribution, commission ledger and payouts.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-xs font-semibold transition",
              tab === t ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && <Overview data={data} />}
      {tab === "Analytics" && <AnalyticsTab data={data} />}
      {tab === "Affiliates" && <AffiliatesTab data={data} refresh={refresh} />}
      {tab === "Referrals" && <ReferralsTab data={data} />}
      {tab === "Products" && <ProductsTab data={data} />}

      {tab === "Commissions" && <CommissionsTab data={data} refresh={refresh} />}
      {tab === "Payout details" && <PayoutDetailsTab data={data} />}
      {tab === "Withdrawals" && <WithdrawalsTab data={data} refresh={refresh} />}
      {tab === "Configuration" && <ConfigTab data={data} refresh={refresh} />}
      {tab === "Logs" && <LogsTab data={data} />}
    </div>
  );
}

type Data = Awaited<ReturnType<typeof adminAffiliateOverview>>;

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-border bg-card p-4", className)}>{children}</div>;
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="admin-table-scroll overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-surface text-xs uppercase text-muted-foreground">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 text-left font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

/** Per-product affiliate performance: link clicks, units sold, commission owed. */
function ProductsTab({ data }: { data: Data }) {
  const rows = data.productStats ?? [];
  if (rows.length === 0) {
    return (
      <Card>
        <div className="text-sm text-muted-foreground">
          No affiliate product activity yet. Set a commission on a product in Products → Affiliate
          Commission, and affiliates will see a share link on that product page.
        </div>
      </Card>
    );
  }
  return (
    <Table head={["Product", "Link clicks", "Units sold", "Commission earned", "Conversion"]}>
      {rows.map((p) => (
        <tr key={p.product_id || p.product_name}>
          <td className="px-3 py-2 font-medium">{p.product_name}</td>
          <td className="px-3 py-2">{p.clicks}</td>
          <td className="px-3 py-2">{p.units}</td>
          <td className="px-3 py-2 font-semibold">{inr(p.commission)}</td>
          <td className="px-3 py-2 text-muted-foreground">
            {p.clicks > 0 ? `${Math.round((p.units / p.clicks) * 1000) / 10}%` : "—"}
          </td>
        </tr>
      ))}
    </Table>
  );
}

function Overview({ data }: { data: Data }) {

  const sum = (s: string) =>
    Math.round(data.commissions.filter((c) => c.status === s).reduce((t, c) => t + Number(c.amount), 0) * 100) / 100;
  const cards = [
    { l: "Affiliates", v: String(data.affiliates.length) },
    { l: "Approved", v: String(data.affiliates.filter((a) => a.status === "approved").length) },
    { l: "Pending applications", v: String(data.affiliates.filter((a) => a.status === "pending").length) },
    { l: "Referred customers", v: String(data.referrals.filter((r) => r.user_id).length) },
    { l: "Referred orders", v: String(data.commissions.length) },
    { l: "Pending commission", v: inr(sum("pending")) },
    { l: "Approved commission", v: inr(sum("approved")) },
    { l: "Paid out", v: inr(sum("paid")) },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.l}>
          <div className="text-xs text-muted-foreground">{c.l}</div>
          <div className="mt-2 text-2xl font-semibold">{c.v}</div>
        </Card>
      ))}
    </div>
  );
}

function AffiliatesTab({ data, refresh }: { data: Data; refresh: () => void }) {
  const updateFn = useServerFn(adminUpdateAffiliate);
  const createFn = useServerFn(adminCreateAffiliate);
  const [q, setQ] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.affiliates.filter(
      (a) =>
        !needle ||
        [a.full_name, a.email, a.mobile, a.code].some((v) => (v ?? "").toLowerCase().includes(needle)),
    );
  }, [data.affiliates, q]);

  const statOf = (id: string) => data.stats.find((s) => s.affiliate_id === id);

  const setStatus = async (id: string, status: "pending" | "approved" | "suspended" | "rejected") => {
    setBusy(id);
    try {
      await updateFn({ data: { id, status } });
      toast.success(`Affiliate ${status}`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(null);
    }
  };

  const setCommission = async (id: string, kind: "percentage" | "fixed", value: string) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) {
      toast.error("Enter a valid commission value");
      return;
    }
    setBusy(id);
    try {
      await updateFn({ data: { id, commission_kind: kind, commission_value: num } });
      toast.success("Commission updated");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, code…"
          className="h-10 max-w-xs"
        />
        <Button className="h-10 rounded-full" onClick={() => setShowNew((v) => !v)}>
          {showNew ? "Close form" : "Register affiliate"}
        </Button>
      </div>

      {showNew && <NewAffiliateForm createFn={createFn} onDone={() => { setShowNew(false); refresh(); }} />}

      <Table head={["Affiliate", "Code", "Status", "Commission", "Referrals", "Orders", "Pending", "Approved", "Paid", "Actions"]}>
        {rows.map((a) => {
          const s = statOf(a.id);
          return (
            <tr key={a.id}>
              <td className="px-3 py-2">
                <div className="font-medium">{a.full_name}</div>
                <div className="text-xs text-muted-foreground">{a.email} · {a.mobile}</div>
              </td>
              <td className="px-3 py-2 font-mono text-xs">{a.code}</td>
              <td className="px-3 py-2 capitalize">{a.status}</td>
              <td className="px-3 py-2">
                <CommissionEditor
                  kind={(a.commission_kind ?? data.settings.default_commission_kind) as "percentage" | "fixed"}
                  value={String(a.commission_value ?? data.settings.default_commission_value)}
                  inherited={a.commission_value == null}
                  disabled={busy === a.id}
                  onSave={(k, v) => setCommission(a.id, k, v)}
                />
              </td>
              <td className="px-3 py-2">{s?.referrals ?? 0}</td>
              <td className="px-3 py-2">{s?.orders ?? 0}</td>
              <td className="px-3 py-2">{inr(s?.pending ?? 0)}</td>
              <td className="px-3 py-2">{inr(s?.approved ?? 0)}</td>
              <td className="px-3 py-2">{inr(s?.paid ?? 0)}</td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {a.status !== "approved" && (
                    <Button size="sm" variant="outline" disabled={busy === a.id} onClick={() => setStatus(a.id, "approved")}>
                      Approve
                    </Button>
                  )}
                  {a.status === "approved" && (
                    <Button size="sm" variant="outline" disabled={busy === a.id} onClick={() => setStatus(a.id, "suspended")}>
                      Suspend
                    </Button>
                  )}
                  {a.status !== "rejected" && (
                    <Button size="sm" variant="ghost" disabled={busy === a.id} onClick={() => setStatus(a.id, "rejected")}>
                      Reject
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
        {rows.length === 0 && (
          <tr>
            <td colSpan={10} className="px-3 py-6 text-center text-sm text-muted-foreground">
              No affiliates yet.
            </td>
          </tr>
        )}
      </Table>
    </div>
  );
}

function CommissionEditor({
  kind,
  value,
  inherited,
  disabled,
  onSave,
}: {
  kind: "percentage" | "fixed";
  value: string;
  inherited: boolean;
  disabled?: boolean;
  onSave: (kind: "percentage" | "fixed", value: string) => void;
}) {
  const [k, setK] = useState(kind);
  const [v, setV] = useState(value);
  return (
    <div className="flex items-center gap-1">
      <select
        value={k}
        onChange={(e) => setK(e.target.value as "percentage" | "fixed")}
        className="h-8 rounded-md border border-border bg-background px-1 text-xs"
      >
        <option value="percentage">%</option>
        <option value="fixed">₹</option>
      </select>
      <Input value={v} onChange={(e) => setV(e.target.value)} className="h-8 w-16 text-xs" />
      <Button size="sm" variant="outline" disabled={disabled} onClick={() => onSave(k, v)}>
        Save
      </Button>
      {inherited && <span className="text-[10px] text-muted-foreground">default</span>}
    </div>
  );
}

function NewAffiliateForm({
  createFn,
  onDone,
}: {
  createFn: ReturnType<typeof useServerFn<typeof adminCreateAffiliate>>;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    full_name: "",
    email: "",
    mobile: "",
    company: "",
    website: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    pan: "",
    gstin: "",
    payout_upi: "",
    payout_account_name: "",
    payout_account_number: "",
    payout_ifsc: "",
    payout_bank: "",
    notes: "",
    code: "",
  });
  const [method, setMethod] = useState<"upi" | "bank">("upi");
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await createFn({ data: { ...f, payout_method: method, status: "approved" } });
      toast.success(`Affiliate created — code ${res.code}`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the affiliate.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
        <Row l="Full name" v={f.full_name} on={set("full_name")} required />
        <Row l="Email" v={f.email} on={set("email")} type="email" required />
        <Row l="Mobile" v={f.mobile} on={set("mobile")} required />
        <Row l="Company" v={f.company} on={set("company")} />
        <Row l="Website" v={f.website} on={set("website")} />
        <Row l="Referral code (optional)" v={f.code} on={set("code")} />
        <Row l="Address" v={f.address} on={set("address")} />
        <Row l="City" v={f.city} on={set("city")} />
        <Row l="State" v={f.state} on={set("state")} />
        <Row l="Pincode" v={f.pincode} on={set("pincode")} />
        <Row l="PAN" v={f.pan} on={set("pan")} />
        <Row l="GSTIN" v={f.gstin} on={set("gstin")} />
        <div className="sm:col-span-3 flex gap-2">
          {(["upi", "bank"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold",
                method === m ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
              )}
            >
              {m === "upi" ? "UPI payout" : "Bank payout"}
            </button>
          ))}
        </div>
        {method === "upi" ? (
          <Row l="UPI ID" v={f.payout_upi} on={set("payout_upi")} required />
        ) : (
          <>
            <Row l="Account name" v={f.payout_account_name} on={set("payout_account_name")} />
            <Row l="Account number" v={f.payout_account_number} on={set("payout_account_number")} required />
            <Row l="IFSC" v={f.payout_ifsc} on={set("payout_ifsc")} required />
            <Row l="Bank" v={f.payout_bank} on={set("payout_bank")} />
          </>
        )}
        <div className="sm:col-span-3">
          <Label className="text-xs">Notes</Label>
          <Textarea rows={2} value={f.notes} onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))} />
        </div>
        <div className="sm:col-span-3">
          <Button disabled={busy} className="rounded-full">
            {busy ? "Creating…" : "Create affiliate"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ReferralsTab({ data }: { data: Data }) {
  return (
    <Table head={["Affiliate", "Customer", "Landing page", "First seen", "Converted", "Attribution expires"]}>
      {data.referrals.map((r) => (
        <tr key={r.id}>
          <td className="px-3 py-2">
            {(r as { affiliates?: { code?: string; full_name?: string } }).affiliates?.full_name ?? "—"}{" "}
            <span className="font-mono text-xs text-muted-foreground">
              {(r as { affiliates?: { code?: string } }).affiliates?.code}
            </span>
          </td>
          <td className="px-3 py-2 font-mono text-xs">{r.user_id ? r.user_id.slice(0, 8) : "anonymous visitor"}</td>
          <td className="px-3 py-2 text-xs">{r.landing_path ?? "—"}</td>
          <td className="px-3 py-2 text-xs">{new Date(r.first_seen_at).toLocaleString()}</td>
          <td className="px-3 py-2 text-xs">{r.converted_at ? new Date(r.converted_at).toLocaleDateString() : "—"}</td>
          <td className="px-3 py-2 text-xs">{new Date(r.expires_at).toLocaleDateString()}</td>
        </tr>
      ))}
      {data.referrals.length === 0 && (
        <tr>
          <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">
            No referral traffic yet.
          </td>
        </tr>
      )}
    </Table>
  );
}

function CommissionsTab({ data, refresh }: { data: Data; refresh: () => void }) {
  const setStatusFn = useServerFn(adminSetCommissionStatus);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const rows = data.commissions.filter((c) => filter === "all" || c.status === filter);

  const apply = async (status: "approved" | "paid" | "reversed" | "cancelled" | "pending") => {
    if (selected.length === 0) {
      toast.error("Select at least one commission");
      return;
    }
    setBusy(true);
    try {
      await setStatusFn({ data: { ids: selected, status } });
      toast.success(`Marked ${selected.length} as ${status}`);
      setSelected([]);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          {["all", "pending", "approved", "paid", "reversed", "cancelled"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {(["approved", "paid", "reversed", "cancelled"] as const).map((s) => (
          <Button key={s} size="sm" variant="outline" disabled={busy} onClick={() => apply(s)}>
            Mark {s}
          </Button>
        ))}
      </div>
      <Table head={["", "Order", "Affiliate", "Order value", "Rate", "Commission", "Status", "Created"]}>
        {rows.map((c) => (
          <tr key={c.id}>
            <td className="px-3 py-2">
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={(e) =>
                  setSelected((prev) => (e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id)))
                }
              />
            </td>
            <td className="px-3 py-2">{c.order_number ?? "—"}</td>
            <td className="px-3 py-2">
              {(c as { affiliates?: { full_name?: string; code?: string } }).affiliates?.full_name ?? "—"}
            </td>
            <td className="px-3 py-2">{inr(Number(c.order_total))}</td>
            <td className="px-3 py-2 text-xs">
              {c.commission_kind === "fixed" ? inr(Number(c.commission_value)) : `${c.commission_value}%`}
            </td>
            <td className="px-3 py-2 font-semibold">{inr(Number(c.amount))}</td>
            <td className="px-3 py-2 capitalize">{c.status}</td>
            <td className="px-3 py-2 text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={8} className="px-3 py-6 text-center text-sm text-muted-foreground">
              No commissions.
            </td>
          </tr>
        )}
      </Table>
    </div>
  );
}

function WithdrawalsTab({ data, refresh }: { data: Data; refresh: () => void }) {
  const setStatusFn = useServerFn(adminSetWithdrawalStatus);
  const [busy, setBusy] = useState<string | null>(null);
  const [ref, setRef] = useState<Record<string, string>>({});

  const act = async (id: string, status: "approved" | "processing" | "paid" | "rejected") => {
    setBusy(id);
    try {
      await setStatusFn({ data: { id, status, reference: ref[id] ?? undefined } });
      toast.success(`Payout ${status}`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Table head={["Affiliate", "Amount", "Method", "Status", "Reference", "Requested", "Actions"]}>
      {data.withdrawals.map((w) => (
        <tr key={w.id}>
          <td className="px-3 py-2">
            {(w as { affiliates?: { full_name?: string; email?: string } }).affiliates?.full_name ?? "—"}
            <div className="text-xs text-muted-foreground">
              {(w as { affiliates?: { email?: string } }).affiliates?.email}
            </div>
          </td>
          <td className="px-3 py-2 font-semibold">{inr(Number(w.amount))}</td>
          <td className="px-3 py-2 text-xs uppercase">{w.method}</td>
          <td className="px-3 py-2 capitalize">{w.status}</td>
          <td className="px-3 py-2">
            <Input
              value={ref[w.id] ?? w.reference ?? ""}
              onChange={(e) => setRef((p) => ({ ...p, [w.id]: e.target.value }))}
              placeholder="UTR / txn ref"
              className="h-8 w-40 text-xs"
            />
          </td>
          <td className="px-3 py-2 text-xs">{new Date(w.created_at).toLocaleDateString()}</td>
          <td className="px-3 py-2">
            <div className="flex flex-wrap gap-1">
              {(["approved", "processing", "paid", "rejected"] as const).map((s) => (
                <Button key={s} size="sm" variant="outline" disabled={busy === w.id} onClick={() => act(w.id, s)}>
                  {s}
                </Button>
              ))}
            </div>
          </td>
        </tr>
      ))}
      {data.withdrawals.length === 0 && (
        <tr>
          <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">
            No payout requests.
          </td>
        </tr>
      )}
    </Table>
  );
}

function ConfigTab({ data, refresh }: { data: Data; refresh: () => void }) {
  const saveFn = useServerFn(adminSaveAffiliateSettings);
  const [s, setS] = useState({ ...data.settings, terms: data.settings.terms ?? "" });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await saveFn({
        data: {
          enabled: s.enabled,
          default_commission_kind: s.default_commission_kind,
          default_commission_value: Number(s.default_commission_value),
          attribution_days: Number(s.attribution_days),
          cookie_days: Number(s.cookie_days),
          min_payout: Number(s.min_payout),
          auto_approve_affiliates: s.auto_approve_affiliates,
          auto_approve_commission_on_delivery: s.auto_approve_commission_on_delivery,
          exclude_shipping: s.exclude_shipping,
          terms: s.terms,
        },
      });
      toast.success("Affiliate settings saved");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save settings");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (k: keyof typeof s, label: string, hint?: string) => (
    <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
      <input
        type="checkbox"
        checked={Boolean(s[k])}
        onChange={(e) => setS((p) => ({ ...p, [k]: e.target.checked }))}
        className="mt-1"
      />
      <span>
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );

  return (
    <Card className="max-w-3xl space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Default commission type</Label>
          <select
            value={s.default_commission_kind}
            onChange={(e) =>
              setS((p) => ({ ...p, default_commission_kind: e.target.value as "percentage" | "fixed" }))
            }
            className="mt-1 h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="percentage">Percentage of order</option>
            <option value="fixed">Fixed amount per order</option>
          </select>
        </div>
        <Row
          l={s.default_commission_kind === "fixed" ? "Default commission (₹)" : "Default commission (%)"}
          v={String(s.default_commission_value)}
          on={(v) => setS((p) => ({ ...p, default_commission_value: Number(v) || 0 }))}
        />
        <Row
          l="Attribution window (days)"
          v={String(s.attribution_days)}
          on={(v) => setS((p) => ({ ...p, attribution_days: Number(v) || 1 }))}
        />
        <Row
          l="Referral cookie lifetime (days)"
          v={String(s.cookie_days)}
          on={(v) => setS((p) => ({ ...p, cookie_days: Number(v) || 1 }))}
        />
        <Row
          l="Minimum payout (₹)"
          v={String(s.min_payout)}
          on={(v) => setS((p) => ({ ...p, min_payout: Number(v) || 0 }))}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {toggle("enabled", "Program enabled", "Turn the whole affiliate program on or off")}
        {toggle("auto_approve_affiliates", "Auto-approve new affiliates")}
        {toggle(
          "auto_approve_commission_on_delivery",
          "Auto-approve commission on delivery",
          "Commission moves from pending to approved when the order is delivered",
        )}
        {toggle("exclude_shipping", "Exclude shipping from commission base")}
      </div>
      <div>
        <Label className="text-xs">Program terms</Label>
        <Textarea rows={5} value={s.terms} onChange={(e) => setS((p) => ({ ...p, terms: e.target.value }))} />
      </div>
      <Button disabled={busy} onClick={save} className="rounded-full">
        {busy ? "Saving…" : "Save configuration"}
      </Button>
    </Card>
  );
}

function LogsTab({ data }: { data: Data }) {
  return (
    <Table head={["When", "Affiliate", "Action", "Detail"]}>
      {data.logs.map((l) => (
        <tr key={l.id}>
          <td className="px-3 py-2 text-xs">{new Date(l.created_at).toLocaleString()}</td>
          <td className="px-3 py-2 font-mono text-xs">
            {(l as { affiliates?: { code?: string } }).affiliates?.code ?? "—"}
          </td>
          <td className="px-3 py-2 text-xs">{l.action}</td>
          <td className="px-3 py-2 text-xs text-muted-foreground">
            {JSON.stringify(l.detail).slice(0, 120)}
          </td>
        </tr>
      ))}
      {data.logs.length === 0 && (
        <tr>
          <td colSpan={4} className="px-3 py-6 text-center text-sm text-muted-foreground">
            No activity yet.
          </td>
        </tr>
      )}
    </Table>
  );
}

function Row({
  l,
  v,
  on,
  type = "text",
  required,
}: {
  l: string;
  v: string;
  on: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label className="text-xs">{l}</Label>
      <Input value={v} onChange={(e) => on(e.target.value)} type={type} required={required} className="mt-1 h-10" />
    </div>
  );
}

/* ------------------------------------------------------------- analytics */

function KPI({ l, v, sub }: { l: string; v: string; sub?: string }) {
  return (
    <Card>
      <div className="text-xs text-muted-foreground">{l}</div>
      <div className="mt-2 text-2xl font-semibold">{v}</div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
    </Card>
  );
}

/** Affiliate marketing analytics: traffic, conversion and commission trend. */
function AnalyticsTab({ data }: { data: Data }) {
  const a = data.analytics;
  const series = (a?.series ?? []).map((r) => ({
    ...r,
    label: new Date(r.day).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
  }));
  const t = a?.totals;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI l="Affiliate link clicks" v={String(t?.clicks ?? 0)} sub="Product + referral links" />
        <KPI l="Tracked visitors" v={String(t?.visitors ?? 0)} sub={`${t?.signups ?? 0} signed up`} />
        <KPI l="Referred orders" v={String(t?.orders ?? 0)} sub={`Click → order ${t?.clickToOrder ?? 0}%`} />
        <KPI l="Average order value" v={inr(t?.aov ?? 0)} />
        <KPI l="Commission generated" v={inr(t?.commission ?? 0)} />
        <KPI l="Payable now" v={inr(t?.payableNow ?? 0)} sub="Approved, not yet withdrawn" />
        <KPI l="Awaiting payout" v={inr(t?.awaitingPayout ?? 0)} sub="Requested / processing" />
        <KPI
          l="Incomplete payment details"
          v={String(t?.incompleteDetails ?? 0)}
          sub="Affiliates you cannot pay yet"
        />
      </div>

      <Card>
        <div className="mb-3 text-sm font-semibold">Clicks, visitors & referred orders (30 days)</div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <ChartTooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="clicks" name="Clicks" stroke="#2563eb" fill="#2563eb33" />
              <Area type="monotone" dataKey="visitors" name="Visitors" stroke="#0ea5e9" fill="#0ea5e933" />
              <Area type="monotone" dataKey="orders" name="Orders" stroke="#16a34a" fill="#16a34a33" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <div className="mb-3 text-sm font-semibold">Commission generated per day</div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} />
              <ChartTooltip formatter={(v: number) => inr(Number(v))} />
              <Bar dataKey="commission" name="Commission" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div>
        <div className="mb-2 text-sm font-semibold">Top affiliates</div>
        <Table head={["Affiliate", "Code", "Clicks", "Referrals", "Orders", "Earned", "Payable now"]}>
          {(a?.leaderboard ?? []).map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2 font-medium">{r.name}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
              <td className="px-3 py-2">{r.clicks}</td>
              <td className="px-3 py-2">{r.referrals}</td>
              <td className="px-3 py-2">{r.orders}</td>
              <td className="px-3 py-2 font-semibold">{inr(r.earned)}</td>
              <td className="px-3 py-2">{inr(r.available)}</td>
            </tr>
          ))}
          {(a?.leaderboard ?? []).length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">
                No affiliate activity yet.
              </td>
            </tr>
          )}
        </Table>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- payout details */

/** Everything Aurona needs to actually transfer commission to an affiliate. */
function PayoutDetailsTab({ data }: { data: Data }) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.affiliates.filter(
      (a) =>
        !needle ||
        [a.full_name, a.email, a.mobile, a.code, a.pan, a.payout_upi, a.payout_account_number].some((v) =>
          (v ?? "").toLowerCase().includes(needle),
        ),
    );
  }, [data.affiliates, q]);

  const copy = async (v: string) => {
    await navigator.clipboard.writeText(v);
    toast.success("Copied");
  };

  return (
    <div className="space-y-4">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name, UPI, account, PAN…"
        className="h-10 max-w-xs"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((a) => {
          const s = data.stats.find((x) => x.affiliate_id === a.id);
          const ready = s?.payout?.ok ?? false;
          const bank = a.payout_method === "bank";
          const payLine = bank
            ? `${a.payout_account_name ?? a.full_name} · ${a.payout_account_number ?? "—"} · ${a.payout_ifsc ?? "—"}`
            : (a.payout_upi ?? "—");
          return (
            <Card key={a.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{a.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-mono">{a.code}</span> · {a.status}
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    ready ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600",
                  )}
                >
                  {ready ? "Payable" : "Details incomplete"}
                </span>
              </div>

              <dl className="grid gap-1.5 text-sm sm:grid-cols-2">
                <D l="Email" v={a.email} />
                <D l="Mobile" v={a.mobile} />
                <D l="Company" v={a.company} />
                <D l="PAN" v={a.pan} />
                <D l="GSTIN" v={a.gstin} />
                <D l="Method" v={bank ? "Bank transfer" : "UPI"} />
                {bank ? (
                  <>
                    <D l="Account name" v={a.payout_account_name} />
                    <D l="Account number" v={a.payout_account_number} />
                    <D l="IFSC" v={a.payout_ifsc} />
                    <D l="Bank" v={a.payout_bank} />
                  </>
                ) : (
                  <D l="UPI ID" v={a.payout_upi} />
                )}
                <D
                  l="Address"
                  v={[a.address, a.city, a.state, a.pincode].filter(Boolean).join(", ") || null}
                />
              </dl>

              <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs">
                <span className="text-muted-foreground">
                  Pending <b className="text-foreground">{inr(s?.pending ?? 0)}</b>
                </span>
                <span className="text-muted-foreground">
                  Payable now <b className="text-foreground">{inr(s?.available ?? 0)}</b>
                </span>
                <span className="text-muted-foreground">
                  Paid <b className="text-foreground">{inr(s?.paid ?? 0)}</b>
                </span>
                <Button size="sm" variant="outline" className="ml-auto" onClick={() => copy(payLine)}>
                  Copy payment info
                </Button>
              </div>

              {!ready && s?.payout?.missing?.length ? (
                <div className="rounded-lg bg-amber-500/10 p-2 text-[11px] text-amber-600">
                  Missing: {s.payout.missing.join(", ")}
                </div>
              ) : null}
            </Card>
          );
        })}
        {rows.length === 0 && (
          <Card>
            <div className="text-sm text-muted-foreground">No affiliates match that search.</div>
          </Card>
        )}
      </div>
    </div>
  );
}

function D({ l, v }: { l: string; v?: string | null }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{l}</dt>
      <dd className="truncate">{v || "—"}</dd>
    </div>
  );
}
