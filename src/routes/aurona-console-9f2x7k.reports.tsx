import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { adminGetReport } from "@/lib/report-admin.functions";
import { Input } from "@/components/ui/input";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/aurona-console-9f2x7k/reports")({ component: ReportsAdmin });

function isoDate(date: Date) { return date.toISOString().slice(0, 10); }

function ReportsAdmin() {
  const today = useMemo(() => new Date(), []);
  const monthAgo = useMemo(() => { const d = new Date(today); d.setUTCDate(d.getUTCDate() - 29); return d; }, [today]);
  const [from, setFrom] = useState(isoDate(monthAgo));
  const [to, setTo] = useState(isoDate(today));
  const getReport = useServerFn(adminGetReport);
  const q = useQuery({ queryKey: ["admin-report", from, to], queryFn: () => getReport({ data: { from, to } }), enabled: Boolean(from && to) });
  const report: any = q.data;

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-semibold">Reports</h1><p className="text-sm text-slate-500">Sales, fulfilment and inventory health from authoritative order and SKU data.</p></div>
      <div className="flex gap-2"><label className="text-xs text-slate-500">From<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label className="text-xs text-slate-500">To<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label></div>
    </div>
    {q.isLoading && <div className="rounded-xl border bg-white p-10 text-center text-slate-500">Building report…</div>}
    {q.error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{(q.error as Error).message}</div>}
    {report && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Orders" value={String(report.orders)} />
        <Metric label="Gross revenue" value={inr(Number(report.gross_revenue))} />
        <Metric label="Average order" value={inr(Number(report.average_order_value))} />
        <Metric label="Discounts" value={inr(Number(report.discounts))} />
        <Metric label="Cancelled" value={String(report.cancelled_orders)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Order status"><Rows rows={report.statuses} name="status" value="count" /></Panel>
        <Panel title="Payment status"><Rows rows={report.payments} name="payment_status" value="count" /></Panel>
        <Panel title="Top SKUs">
          <div className="divide-y">{report.top_skus.map((row: any) => <div key={`${row.sku}-${row.product_name}`} className="flex justify-between gap-3 py-2 text-sm"><div><div className="font-medium">{row.product_name}</div><div className="font-mono text-xs text-slate-500">{row.sku || "Legacy product"}</div></div><div className="text-right"><div>{row.units} units</div><div className="text-xs text-slate-500">{inr(Number(row.revenue))}</div></div></div>)}</div>
        </Panel>
        <Panel title="Low stock SKUs">
          <div className="divide-y">{report.low_stock.map((row: any) => <Link key={row.id} to="/aurona-console-9f2x7k/inventory" className="flex justify-between gap-3 py-2 text-sm hover:text-sky-700"><div><div className="font-medium">{row.name}</div><div className="font-mono text-xs text-slate-500">{row.sku}</div></div><div className={Number(row.available) <= 0 ? "font-semibold text-rose-600" : "font-semibold text-amber-600"}>{row.available} available</div></Link>)}</div>
        </Panel>
      </div>
    </>}
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-white p-4"><div className="text-xs uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div></div>; }
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-xl border bg-white p-4"><h2 className="mb-3 font-semibold">{title}</h2>{children}</div>; }
function Rows({ rows, name, value }: { rows: any[]; name: string; value: string }) { return <div className="divide-y">{rows.map((row) => <div key={row[name]} className="flex justify-between py-2 text-sm"><span className="capitalize">{String(row[name]).replaceAll("_", " ")}</span><span className="font-semibold">{row[value]}</span></div>)}</div>; }
