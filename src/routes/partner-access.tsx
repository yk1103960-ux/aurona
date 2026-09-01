/**
 * Retailer / Distributor onboarding gate.
 *
 * Google (or e-mail) authentication only verifies identity. This page decides
 * what happens next, from the server-verified application state:
 *   none      → show the role's application form
 *   pending   → show the "Request Pending" screen (no dashboard access)
 *   rejected  → show the rejected screen (re-apply allowed)
 *   approved  → send the user to their own dashboard
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Store, ShieldCheck, Clock, XCircle, Loader2, CheckCircle2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { INDIAN_STATES } from "@/lib/indian-states";
import { DASHBOARD_PATHS } from "@/lib/role-routing";
import { getPartnerApplication, submitRoleApplication } from "@/lib/partner-access.functions";
import { PageLoading } from "@/components/layout/PageLoading";

type Role = "retailer" | "distributor";

export const Route = createFileRoute("/partner-access")({
  validateSearch: (search: Record<string, unknown>) => {
    const r = search["role"];
    return { role: (r === "distributor" ? "distributor" : "retailer") as Role };
  },
  head: () => ({
    meta: [
      { title: "Retailer & Distributor Application — Aurona Lighting" },
      {
        name: "description",
        content:
          "Apply for an Aurona retailer or distributor account. Submit your business details and unlock trade pricing after admin approval.",
      },
      { property: "og:title", content: "Retailer & Distributor Application — Aurona Lighting" },
      {
        property: "og:description",
        content: "Submit your Aurona retailer or distributor application and track its approval status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PartnerAccessPage,
});

const META: Record<Role, { title: string; Icon: any; blurb: string }> = {
  retailer: {
    title: "Retailer Account",
    Icon: Store,
    blurb: "Stock Aurona in your shop with retailer-margin pricing and priority dispatch.",
  },
  distributor: {
    title: "Distributor Account",
    Icon: Building2,
    blurb: "Distribute Aurona across your territory with channel pricing and volume support.",
  },
};

function PartnerAccessPage() {
  const { role } = Route.useSearch();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const fetchApp = useServerFn(getPartnerApplication);
  const meta = META[role];

  const q = useQuery({
    queryKey: ["partner-application", user?.id, role],
    enabled: !!user,
    queryFn: async () => fetchApp({ data: { role } }),
  });

  // Approved applicants belong on their dashboard, never on this page.
  useEffect(() => {
    if (q.data?.state === "approved") nav({ to: DASHBOARD_PATHS[role], replace: true });
  }, [q.data?.state, role, nav]);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/auth", search: { role }, replace: true });
  };

  if (loading) return <PageLoading />;

  if (!user) {
    return (
      <Shell role={role}>
        <div className="space-y-4 text-center">
          <h2 className="text-xl font-bold">Sign in to apply</h2>
          <p className="text-sm text-muted-foreground">
            Verify your identity with Google (or e-mail) to start your {meta.title.toLowerCase()} application.
          </p>
          <Button asChild className="h-11 rounded-full px-6">
            <Link to="/auth" search={{ role }}>Continue to sign in</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  if (q.isLoading) return <PageLoading />;

  const state = q.data?.state ?? "none";

  if (state === "pending" || state === "under_review") {
    return (
      <Shell role={role}>
        <div className="space-y-5 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-100 text-amber-700">
            <Clock className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Request Pending</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your {meta.title.toLowerCase()} request has been submitted successfully. Your account is currently
              waiting for administrator approval. You will be able to access this account after approval.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-4 text-left text-xs text-muted-foreground">
            <Row label="Applicant" value={q.data?.prefill.full_name || "—"} />
            <Row label="Email (Google verified)" value={q.data?.email || "—"} />
            <Row label="Requested account" value={meta.title} />
            <Row label="Business" value={q.data?.application?.business_name || "—"} />
            <Row
              label="Submitted"
              value={q.data?.application?.created_at ? new Date(q.data.application.created_at).toLocaleString("en-IN") : "—"}
            />
            <Row label="Status" value={state === "under_review" ? "Under review" : "Pending approval"} />
          </div>
          <Button disabled className="h-11 w-full rounded-full">
            <Clock className="mr-2 h-4 w-4" /> Request Pending
          </Button>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
            <Button variant="outline" className="rounded-full" onClick={() => q.refetch()}>
              Refresh status
            </Button>
            <Button variant="ghost" className="rounded-full" onClick={signOut}>
              <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  if (state === "rejected") {
    return (
      <Shell role={role}>
        <div className="space-y-5 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-rose-100 text-rose-700">
            <XCircle className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-bold">Request Rejected</h2>
          <p className="text-sm text-muted-foreground">
            Your {meta.title.toLowerCase()} request was not approved.
            {q.data?.application?.admin_notes ? ` Reason: ${q.data.application.admin_notes}` : ""} You can correct your
            details and apply again, or contact our team for help.
          </p>
          <ApplicationForm role={role} email={q.data?.email ?? user.email ?? ""} prefill={q.data?.prefill} onDone={() => q.refetch()} />
        </div>
      </Shell>
    );
  }

  return (
    <Shell role={role}>
      <ApplicationForm role={role} email={q.data?.email ?? user.email ?? ""} prefill={q.data?.prefill} onDone={() => q.refetch()} />
    </Shell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-1.5 last:border-0">
      <span className="font-semibold">{label}</span>
      <span className="text-right text-foreground">{value}</span>
    </div>
  );
}

function Shell({ role, children }: { role: Role; children: React.ReactNode }) {
  const meta = META[role];
  return (
    <div className="container-x py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
            <meta.Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-eyebrow">Applying for</div>
            <h1 className="text-display text-2xl">{meta.title}</h1>
          </div>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">{meta.blurb}</p>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">{children}</div>
        <p className="mt-4 flex items-center justify-center gap-2 text-center text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          Trade pricing and dashboard access unlock only after Aurona approves this request.
        </p>
      </div>
    </div>
  );
}

type Prefill = { full_name: string; mobile: string; business_name: string; gstin: string } | undefined;

function ApplicationForm({
  role,
  email,
  prefill,
  onDone,
}: {
  role: Role;
  email: string;
  prefill: Prefill;
  onDone: () => void;
}) {
  const submit = useServerFn(submitRoleApplication);
  const qc = useQueryClient();
  const [f, setF] = useState(() => ({
    full_name: prefill?.full_name ?? "",
    mobile: (prefill?.mobile ?? "").replace(/\D/g, "").slice(-10),
    business_name: prefill?.business_name ?? "",
    owner_name: "",
    business_type: "",
    gstin: prefill?.gstin ?? "",
    pan: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    years_in_business: "",
    expected_monthly_purchase: "",
    distribution_area: "",
    warehouse_capacity: "",
    sales_team_size: "",
    existing_brands: "",
  }));
  const set = (k: keyof typeof f) => (v: string) => setF((c) => ({ ...c, [k]: v }));

  const mut = useMutation({
    mutationFn: async () => submit({ data: { role, ...f } }),
    onSuccess: () => {
      toast.success("Request submitted — awaiting administrator approval.");
      qc.invalidateQueries({ queryKey: ["partner-access-state"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message || "Please check the highlighted details and try again."),
  });

  const ready = useMemo(
    () =>
      f.full_name.trim().length >= 3 &&
      /^[6-9]\d{9}$/.test(f.mobile) &&
      f.business_name.trim().length >= 2 &&
      f.address.trim().length >= 6 &&
      f.city.trim().length >= 2 &&
      f.state.trim().length >= 2 &&
      /^\d{6}$/.test(f.pincode),
    [f],
  );

  return (
    <form
      className="space-y-4 text-left"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return toast.error("Please complete all required business details.");
        mut.mutate();
      }}
    >
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-[11px] text-muted-foreground">
        You are applying for an <b>Aurona {role === "retailer" ? "Retailer" : "Distributor"} Account</b>. Your Google
        verified email is locked to this request.
      </div>

      <Text label="Full name *" value={f.full_name} onChange={set("full_name")} />
      <div>
        <Label className="text-xs">Email (Google verified)</Label>
        <div className="mt-1 flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span className="truncate">{email}</span>
        </div>
      </div>
      <div>
        <Label className="text-xs">Mobile number *</Label>
        <div className="mt-1 flex items-center gap-2">
          <span className="rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-sm">+91</span>
          <Input
            value={f.mobile}
            onChange={(e) => set("mobile")(e.target.value.replace(/\D/g, "").slice(0, 10))}
            inputMode="numeric"
            placeholder="10-digit mobile"
          />
        </div>
      </div>

      <Text label={role === "retailer" ? "Shop / Business name *" : "Distribution firm / Company name *"} value={f.business_name} onChange={set("business_name")} />
      <Text label="Contact person / Owner name" value={f.owner_name} onChange={set("owner_name")} />
      <Text label="Business type (proprietorship, Pvt Ltd, LLP…)" value={f.business_type} onChange={set("business_type")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Text label="GST number (if applicable)" value={f.gstin} onChange={(v) => set("gstin")(v.toUpperCase())} />
        <Text label="PAN" value={f.pan} onChange={(v) => set("pan")(v.toUpperCase())} />
      </div>

      <div>
        <Label className="text-xs">Complete business address *</Label>
        <Textarea className="mt-1" rows={3} value={f.address} onChange={(e) => set("address")(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Text label="City *" value={f.city} onChange={set("city")} />
        <div>
          <Label className="text-xs">State *</Label>
          <select
            className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
            value={f.state}
            onChange={(e) => set("state")(e.target.value)}
          >
            <option value="">Select state</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">PIN code *</Label>
          <Input
            className="mt-1"
            value={f.pincode}
            inputMode="numeric"
            onChange={(e) => set("pincode")(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Text label="Years in business" value={f.years_in_business} onChange={set("years_in_business")} />
        <Text label="Expected monthly purchase" value={f.expected_monthly_purchase} onChange={set("expected_monthly_purchase")} />
      </div>

      {role === "distributor" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Distribution area / territory" value={f.distribution_area} onChange={set("distribution_area")} />
          <Text label="Warehouse capacity" value={f.warehouse_capacity} onChange={set("warehouse_capacity")} />
          <Text label="Sales team size" value={f.sales_team_size} onChange={set("sales_team_size")} />
          <Text label="Existing brands handled" value={f.existing_brands} onChange={set("existing_brands")} />
        </div>
      )}
      {role === "retailer" && (
        <Text label="Existing brands stocked" value={f.existing_brands} onChange={set("existing_brands")} />
      )}

      <Button className="h-11 w-full rounded-full" disabled={mut.isPending}>
        {mut.isPending ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting request…</>
        ) : (
          `Submit ${role === "retailer" ? "Retailer" : "Distributor"} request`
        )}
      </Button>
      <p className="text-center text-[11px] text-muted-foreground">
        Submitting creates a pending request. An administrator must approve it before the dashboard and trade pricing
        become available.
      </p>
    </form>
  );
}

function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input className="mt-1" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
