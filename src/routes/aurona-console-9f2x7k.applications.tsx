import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { listPartnerApplications, reviewPartnerApplication } from "@/lib/partner-admin.functions";

export const Route = createFileRoute("/aurona-console-9f2x7k/applications")({
  head: () => ({
    meta: [
      { title: "Partner Applications — Aurona Console" },
      {
        name: "description",
        content: "Review, verify, approve or reject Aurona retailer and distributor applications.",
      },
      { property: "og:title", content: "Partner Applications — Aurona Console" },
      {
        property: "og:description",
        content: "Review, verify, approve or reject Aurona retailer and distributor applications.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ApplicationsPage,
});

type App = {
  id: string;
  user_id: string | null;
  partner_type: string;
  status: string;
  full_name: string;
  business_name: string | null;
  owner_name: string | null;
  mobile: string;
  email: string;
  gstin: string | null;
  pan: string | null;
  cin: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  business_type: string | null;
  years_in_business: string | null;
  expected_monthly_purchase: string | null;
  distribution_area: string | null;
  warehouse_capacity: string | null;
  sales_team_size: string | null;
  existing_brands: string | null;
  monthly_purchase_volume: string | null;
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
};

const TABS = [
  { key: "all", label: "All" },
  { key: "retailer", label: "Retailers" },
  { key: "distributor", label: "Distributors" },
  { key: "pending", label: "Pending" },
  { key: "under_review", label: "Under Review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
] as const;

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  under_review: "bg-sky-100 text-sky-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
};

function ApplicationsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<App | null>(null);
  const [note, setNote] = useState("");
  const qc = useQueryClient();
  const list = useServerFn(listPartnerApplications);
  const review = useServerFn(reviewPartnerApplication);

  const filter = useMemo(() => {
    if (tab === "retailer" || tab === "distributor") return { partnerType: tab };
    if (tab === "all") return {};
    return { status: tab };
  }, [tab]);

  const q = useQuery({
    queryKey: ["admin-partner-apps", tab, search],
    queryFn: async () => (await list({ data: { ...filter, search: search || undefined } })) as unknown as App[],
    refetchInterval: 30_000,
  });

  const mut = useMutation({
    mutationFn: async (vars: { id: string; decision: string }) =>
      review({ data: { id: vars.id, decision: vars.decision as never, note } }),
    onSuccess: (_r, vars) => {
      toast.success(`Application marked ${vars.decision.replace("_", " ")}`);
      setNote("");
      setOpen(null);
      qc.invalidateQueries({ queryKey: ["admin-partner-apps"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not update application"),
  });

  const rows = q.data ?? [];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold sm:text-2xl">Partner Applications</h1>
        <p className="mt-1 text-sm text-slate-500">
          Retailer and distributor requests. Review, verify, approve or reject — all changes are saved server-side and
          audit-logged.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              tab === t.key
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
            }`}
          >
            {t.label}
          </button>
        ))}
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, mobile, business"
          className="h-9 w-full max-w-xs bg-white"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="hidden grid-cols-[1.4fr_1fr_1fr_.8fr_.8fr_auto] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid">
          <div>Applicant</div>
          <div>Business</div>
          <div>Contact</div>
          <div>Type</div>
          <div>Submitted</div>
          <div>Status</div>
        </div>

        {q.isLoading && <div className="p-6 text-sm text-slate-500">Loading applications…</div>}
        {q.isError && (
          <div className="p-6 text-sm text-rose-600">
            {(q.error as Error)?.message || "Could not load applications"}
          </div>
        )}
        {!q.isLoading && rows.length === 0 && (
          <div className="p-6 text-sm text-slate-500">No applications in this view.</div>
        )}

        {rows.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => {
              setOpen(a);
              setNote(a.admin_notes ?? "");
            }}
            className="grid w-full grid-cols-1 gap-1.5 border-b border-slate-100 px-4 py-3 text-left text-sm hover:bg-slate-50 lg:grid-cols-[1.4fr_1fr_1fr_.8fr_.8fr_auto] lg:items-center lg:gap-3"
          >
            <div className="font-medium text-slate-900">{a.full_name}</div>
            <div className="text-slate-600">{a.business_name || "—"}</div>
            <div className="min-w-0 text-slate-600">
              <div className="truncate">{a.email}</div>
              <div className="text-xs text-slate-400">{a.mobile}</div>
            </div>
            <div className="text-slate-600 capitalize">{a.partner_type}</div>
            <div className="text-xs text-slate-500">{new Date(a.created_at).toLocaleDateString("en-IN")}</div>
            <div>
              <span
                className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                  STATUS_STYLE[a.status] ?? "bg-slate-100 text-slate-700"
                }`}
              >
                {a.status.replace("_", " ")}
              </span>
            </div>
          </button>
        ))}
      </div>

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle className="capitalize">
                  {open.partner_type} application — {open.full_name}
                </SheetTitle>
                <SheetDescription>
                  Submitted {new Date(open.created_at).toLocaleString("en-IN")} · status{" "}
                  <span className="font-semibold capitalize">{open.status.replace("_", " ")}</span>
                </SheetDescription>
              </SheetHeader>

              <dl className="mt-5 space-y-2 text-sm">
                {(
                  [
                    ["Business name", open.business_name],
                    ["Owner", open.owner_name],
                    ["Email", open.email],
                    ["Mobile", open.mobile],
                    ["GSTIN", open.gstin],
                    ["PAN", open.pan],
                    ["CIN", open.cin],
                    ["Address", open.address],
                    ["City", open.city],
                    ["State", open.state],
                    ["Pincode", open.pincode],
                    ["Business type", open.business_type],
                    ["Years in business", open.years_in_business],
                    ["Expected monthly purchase", open.expected_monthly_purchase],
                    ["Distribution area", open.distribution_area],
                    ["Warehouse capacity", open.warehouse_capacity],
                    ["Sales team size", open.sales_team_size],
                    ["Existing brands", open.existing_brands],
                    ["Monthly purchase volume", open.monthly_purchase_volume],
                  ] as [string, string | null][]
                )
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[150px_1fr] gap-3 border-b border-slate-100 pb-2">
                      <dt className="text-slate-500">{k}</dt>
                      <dd className="break-words text-slate-900">{v}</dd>
                    </div>
                  ))}
              </dl>

              <div className="mt-5 space-y-2">
                <label htmlFor="app-note" className="text-xs font-medium text-slate-500">
                  Internal note / reason (optional)
                </label>
                <Textarea
                  id="app-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Verification notes or reason for rejection"
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={mut.isPending || open.status === "under_review"}
                  onClick={() => mut.mutate({ id: open.id, decision: "under_review" })}
                >
                  Mark under review
                </Button>
                <Button disabled={mut.isPending} onClick={() => mut.mutate({ id: open.id, decision: "approved" })}>
                  Verify & approve
                </Button>
                <Button
                  variant="destructive"
                  disabled={mut.isPending}
                  onClick={() => mut.mutate({ id: open.id, decision: "rejected" })}
                >
                  Reject
                </Button>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Status can be changed later by Admin if required. Add a note/reason before changing the decision.
              </p>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
