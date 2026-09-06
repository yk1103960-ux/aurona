import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useRealtime } from "@/hooks/useAdmin";
import { inr } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { adminListOrders } from "@/lib/order-admin.functions";

export const Route = createFileRoute("/aurona-console-9f2x7k/orders")({
  component: OrdersAdmin,
});

const STATUS_COLORS: Record<string, string> = {
  placed: "bg-amber-100 text-amber-700",
  confirmed: "bg-sky-100 text-sky-700",
  packed: "bg-indigo-100 text-indigo-700",
  shipped: "bg-violet-100 text-violet-700",
  out_for_delivery: "bg-fuchsia-100 text-fuchsia-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
};

function OrdersAdmin() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const listOrders = useServerFn(adminListOrders);
  const pageSize = 50;

  useEffect(() => setPage(0), [search, status, paymentStatus, from, to]);

  const q = useQuery({
    queryKey: ["admin-orders", search, status, paymentStatus, from, to, page],
    queryFn: () => listOrders({ data: { search, status: status as any, paymentStatus, from, to, page, pageSize } }),
  });
  useRealtime(["orders"], () => qc.invalidateQueries({ queryKey: ["admin-orders"] }));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Orders</h1>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search by number, name, phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 border rounded-md px-3 text-sm bg-white">
          <option value="">All statuses</option>
          {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="h-10 border rounded-md px-3 text-sm bg-white">
          <option value="">All payments</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
        <Input aria-label="Orders from date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
        <Input aria-label="Orders to date" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="p-3 text-left">Order</th>
              <th className="p-3 text-left">Customer</th>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3 text-left">Payment</th>
              <th className="p-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(q.data?.rows ?? []).map((o) => (
              <tr key={o.id} className="hover:bg-slate-50 cursor-pointer">
                <td className="p-3">
                  <Link to="/aurona-console-9f2x7k/orders/$id" params={{ id: o.id }} className="font-medium hover:text-sky-600">{o.order_number}</Link>
                </td>
                <td className="p-3">
                  <div>{o.full_name}</div>
                  <div className="text-xs text-slate-500">{o.phone}</div>
                </td>
                <td className="p-3 text-xs text-slate-500">{new Date(o.created_at).toLocaleString()}</td>
                <td className="p-3 text-right font-semibold">{inr(Number(o.total))}</td>
                <td className="p-3 text-xs uppercase"><div>{o.payment_method}</div><div className="text-slate-500">{o.payment_status}</div></td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[o.status] ?? "bg-slate-100"}`}>{o.status}</span>
                </td>
              </tr>
            ))}
            {q.isLoading && <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading…</td></tr>}
            {!q.isLoading && q.data?.rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No orders.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>{q.data?.count ?? 0} orders · page {page + 1}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0 || q.isFetching} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="w-4 h-4 mr-1" /> Previous</Button>
          <Button variant="outline" size="sm" disabled={(page + 1) * pageSize >= (q.data?.count ?? 0) || q.isFetching} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
        </div>
      </div>
    </div>
  );
}
