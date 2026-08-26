import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Loader2, TrendingUp, Users, Wallet, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { validateEmail } from "@/lib/email-validation";
import { useAuth } from "@/hooks/useAuth";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  applyAsAffiliate,
  getMyAffiliate,
  requestWithdrawal,
} from "@/lib/affiliate.functions";

export const Route = createFileRoute("/affiliate")({
  head: () => ({
    meta: [
      { title: "Affiliate & Referral Program | Aurona Lighting" },
      {
        name: "description",
        content:
          "Earn commission on every Aurona Lighting order you refer. Track referrals, commissions and payouts from your affiliate dashboard.",
      },
      { property: "og:title", content: "Affiliate & Referral Program | Aurona Lighting" },
      {
        property: "og:description",
        content: "Join the Aurona affiliate program and earn commission on every referred order.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AffiliatePage,
});

function AffiliatePage() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const myAffiliateFn = useServerFn(getMyAffiliate);
  const { data, isLoading } = useQuery({
    queryKey: ["my-affiliate", user?.id],
    enabled: !!user,
    queryFn: () => myAffiliateFn({}),
  });

  // Real-time sync: refresh whenever the affiliate account, commissions or payouts change
  useEffect(() => {
    if (!user) return;
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["my-affiliate", user.id] });
    };
    const channel = supabase
      .channel(`affiliate-sync-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "affiliates" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "affiliate_commissions" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "affiliate_withdrawals" }, invalidate)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);


  return (
    <div>
      <section className="bg-surface">
        <div className="container-x py-16">
          <div className="text-eyebrow">Affiliate & Referral Program</div>
          <h1 className="text-display mt-3 max-w-3xl text-4xl sm:text-5xl">
            Share Aurona. Earn on every order.
          </h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Recommend India's fast-growing lighting and appliance brand to your audience, customers or
            network. Every order placed through your referral link earns you commission — tracked
            automatically and paid out to your UPI or bank account.
          </p>
        </div>
      </section>

      <section className="container-x py-14">
        {loading || (user && isLoading) ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your affiliate account…
          </div>
        ) : !user ? (
          <SignedOut />
        ) : data?.affiliate ? (
          <Dashboard data={data} />
        ) : (
          <ApplyForm />
        )}
      </section>
    </div>
  );
}

function SignedOut() {
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
      <Benefits />
      <div className="rounded-2xl border border-border bg-card p-8">
        <h2 className="text-display text-2xl">Sign in to join</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your affiliate account is linked to your Aurona login, so you can track referrals and
          request payouts securely.
        </p>
        <Button asChild className="mt-6 h-11 rounded-full">
          <Link to="/auth">Sign in or create an account</Link>
        </Button>
      </div>
    </div>
  );
}

function Benefits() {
  const items = [
    "Commission on every referred order, tracked automatically",
    "30-day attribution — you earn even if they buy later",
    "Real-time dashboard for clicks, orders and earnings",
    "Payouts to UPI or bank transfer once approved",
    "Full 400+ product catalogue to promote",
  ];
  return (
    <div>
      <h2 className="text-display text-3xl">Why join</h2>
      <ul className="mt-6 space-y-4 text-sm text-muted-foreground">
        {items.map((t) => (
          <li key={t} className="flex gap-3">
            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ApplyForm() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const applyFn = useServerFn(applyAsAffiliate);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<"upi" | "bank">("upi");
  const [f, setF] = useState({
    full_name: "",
    email: user?.email ?? "",
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
  });
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailCheck = validateEmail(f.email);
    if (!emailCheck.ok) {
      toast.error(emailCheck.reason ?? "Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const res = await applyFn({ data: { ...f, payout_method: method } });
      toast.success(
        res.status === "approved"
          ? `You're in! Your referral code is ${res.code}.`
          : "Application submitted — our team will review it shortly.",
      );
      await qc.invalidateQueries({ queryKey: ["my-affiliate"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit your application.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
      <Benefits />
      <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6">
        <div className="text-eyebrow mb-4">Affiliate application</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field l="Full name" v={f.full_name} on={set("full_name")} required />
          <Field l="Email" v={f.email} on={set("email")} type="email" required />
          <Field l="Mobile" v={f.mobile} on={set("mobile")} required />
          <Field l="Company / channel" v={f.company} on={set("company")} />
          <Field l="Website or social profile" v={f.website} on={set("website")} full />
          <Field l="Address" v={f.address} on={set("address")} full />
          <Field l="City" v={f.city} on={set("city")} />
          <Field l="State" v={f.state} on={set("state")} />
          <Field l="Pincode" v={f.pincode} on={set("pincode")} />
          <Field l="PAN (optional)" v={f.pan} on={set("pan")} />
          <Field l="GSTIN (optional)" v={f.gstin} on={set("gstin")} />
        </div>

        <div className="mt-6 text-eyebrow">Payout details</div>
        <div className="mt-2 flex gap-2">
          {(["upi", "bank"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-xs font-semibold transition",
                method === m ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
              )}
            >
              {m === "upi" ? "UPI" : "Bank transfer"}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {method === "upi" ? (
            <Field l="UPI ID" v={f.payout_upi} on={set("payout_upi")} full required />
          ) : (
            <>
              <Field l="Account holder name" v={f.payout_account_name} on={set("payout_account_name")} />
              <Field l="Bank name" v={f.payout_bank} on={set("payout_bank")} />
              <Field l="Account number" v={f.payout_account_number} on={set("payout_account_number")} required />
              <Field l="IFSC" v={f.payout_ifsc} on={set("payout_ifsc")} required />
            </>
          )}
        </div>

        <div className="mt-4">
          <Label className="text-xs">How will you promote Aurona?</Label>
          <Textarea
            className="mt-1"
            rows={4}
            value={f.notes}
            onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))}
            maxLength={1000}
          />
        </div>
        <Button className="mt-6 h-11 w-full rounded-full" disabled={busy}>
          {busy ? "Submitting…" : "Submit application"}
        </Button>
      </form>
    </div>
  );
}

type MyAffiliate = Awaited<ReturnType<typeof getMyAffiliate>>;

function Dashboard({ data }: { data: MyAffiliate }) {
  const aff = data.affiliate!;
  const balance = data.balance!;
  const qc = useQueryClient();
  const withdrawFn = useServerFn(requestWithdrawal);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const link =
    typeof window !== "undefined" ? `${window.location.origin}/?ref=${aff.code}` : `/?ref=${aff.code}`;

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    toast.success("Referral link copied");
  };

  const withdraw = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setBusy(true);
    try {
      await withdrawFn({ data: { amount: value } });
      toast.success("Withdrawal request submitted");
      setAmount("");
      await qc.invalidateQueries({ queryKey: ["my-affiliate"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit the request.");
    } finally {
      setBusy(false);
    }
  };

  if (aff.status !== "approved") {
    return (
      <div className="rounded-2xl border border-border bg-card p-8">
        <h2 className="text-display text-2xl">Application {aff.status}</h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          {aff.status === "pending"
            ? "Your affiliate application is under review. We'll email you as soon as it's approved — usually within 1–2 business days."
            : aff.status === "suspended"
              ? "Your affiliate account is currently suspended. Please contact support for details."
              : "Your affiliate application was not approved. You can contact support if you think this is a mistake."}
        </p>
        <Button asChild variant="outline" className="mt-6 rounded-full">
          <Link to="/customer-service">Contact support</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="text-eyebrow">Your referral link</div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <code className="flex-1 truncate rounded-xl bg-surface px-4 py-3 text-sm">{link}</code>
          <Button onClick={copy} className="h-11 rounded-full">
            <Copy className="mr-2 h-4 w-4" /> Copy link
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Code <span className="font-semibold text-foreground">{aff.code}</span> ·{" "}
          {aff.commission_kind === "fixed"
            ? `${inr(aff.commission_value)} per order`
            : `${aff.commission_value}% commission`}{" "}
          · {data.settings.attribution_days}-day attribution
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Referred customers" value={String(data.referrals!.length)} />
        <Stat icon={TrendingUp} label="Referred orders" value={String(data.commissions!.length)} />
        <Stat icon={Wallet} label="Pending commission" value={inr(balance.pending)} />
        <Stat icon={BadgeCheck} label="Available to withdraw" value={inr(balance.available)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="text-eyebrow mb-4">Commission history</div>
          {data.commissions!.length === 0 ? (
            <p className="text-sm text-muted-foreground">No referred orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 text-left">Order</th>
                    <th className="py-2 text-right">Order value</th>
                    <th className="py-2 text-right">Commission</th>
                    <th className="py-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.commissions!.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2">{c.order_number ?? "—"}</td>
                      <td className="py-2 text-right">{inr(Number(c.order_total))}</td>
                      <td className="py-2 text-right font-semibold">{inr(Number(c.amount))}</td>
                      <td className="py-2 text-right capitalize">{c.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="text-eyebrow mb-3">Request a payout</div>
            <p className="text-xs text-muted-foreground">
              Available {inr(balance.available)} · minimum payout {inr(data.settings.min_payout)}
            </p>
            <div className="mt-3 flex gap-2">
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="Amount"
                className="h-11"
              />
              <Button onClick={withdraw} disabled={busy} className="h-11 rounded-full">
                {busy ? "…" : "Request"}
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="text-eyebrow mb-3">Payout requests</div>
            {data.withdrawals!.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payout requests yet.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {data.withdrawals!.map((w) => (
                  <li key={w.id} className="flex items-center justify-between py-2">
                    <span>{inr(Number(w.amount))}</span>
                    <span className="text-xs capitalize text-muted-foreground">{w.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <Icon className="h-5 w-5 text-primary" />
      <div className="mt-3 text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Field({
  l,
  v,
  on,
  type = "text",
  full,
  required,
}: {
  l: string;
  v: string;
  on: (v: string) => void;
  type?: string;
  full?: boolean;
  required?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <Label className="text-xs">{l}</Label>
      <Input
        value={v}
        onChange={(e) => on(e.target.value)}
        type={type}
        required={required}
        className="mt-1 h-11"
      />
    </div>
  );
}
