import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useAdmin";
import { inr } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export const Route = createFileRoute("/admin/orders")({
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

  const q = useQuery({
    queryKey: ["admin-orders", search, status],
    queryFn: async () => {
      let query = supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(100);
      if (search) query = query.or(`order_number.ilike.%${search}%,full_name.ilike.%${search}%,phone.ilike.%${search}%`);
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
  useRealtime(["orders"], () => qc.invalidateQueries({ queryKey: ["admin-orders"] }));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Orders</h1>
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search by number, name, phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 border rounded-md px-3 text-sm bg-white">
          <option value="">All statuses</option>
          {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
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
            {(q.data ?? []).map((o) => (
              <tr key={o.id} className="hover:bg-slate-50 cursor-pointer">
                <td className="p-3">
                  <Link to="/admin/orders/$id" params={{ id: o.id }} className="font-medium hover:text-sky-600">{o.order_number}</Link>
                </td>
                <td className="p-3">
                  <div>{o.full_name}</div>
                  <div className="text-xs text-slate-500">{o.phone}</div>
                </td>
                <td className="p-3 text-xs text-slate-500">{new Date(o.created_at).toLocaleString()}</td>
                <td className="p-3 text-right font-semibold">{inr(Number(o.total))}</td>
                <td className="p-3 text-xs uppercase">{o.payment_method}</td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[o.status] ?? "bg-slate-100"}`}>{o.status}</span>
                </td>
              </tr>
            ))}
            {q.isLoading && <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading…</td></tr>}
            {!q.isLoading && q.data?.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No orders.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
