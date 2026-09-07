import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useAdmin";
import { inr } from "@/lib/format";
import {
  Package, ShoppingCart, Users, IndianRupee, AlertTriangle,
  Clock, CheckCircle2, XCircle, TrendingUp, FolderTree,
} from "lucide-react";

export const Route = createFileRoute("/aurona-console-9f2x7k/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const q = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const [orders, products, categories, customers, recentOrders, lowStock] = await Promise.all([
        supabase.from("orders").select("id, status, total, created_at"),
        supabase.from("products").select("id, stock, is_published", { count: "exact", head: false }),
        supabase.from("categories").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("id, order_number, full_name, total, status, created_at").order("created_at", { ascending: false }).limit(8),
        supabase.from("products").select("id, name, stock").lt("stock", 10).order("stock").limit(8),
      ]);
      const allOrders = orders.data ?? [];
      const totalRevenue = allOrders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + Number(o.total || 0), 0);
      const byStatus = allOrders.reduce<Record<string, number>>((m, o) => { m[o.status] = (m[o.status] ?? 0) + 1; return m; }, {});
      const monthly: Record<string, number> = {};
      for (const o of allOrders) {
        if (o.status === "cancelled") continue;
        const k = new Date(o.created_at).toLocaleString("en", { month: "short", year: "2-digit" });
        monthly[k] = (monthly[k] ?? 0) + Number(o.total || 0);
      }
      return {
        totalOrders: allOrders.length,
        totalRevenue,
        totalProducts: products.data?.length ?? 0,
        publishedProducts: products.data?.filter((p) => p.is_published).length ?? 0,
        totalCategories: categories.count ?? 0,
        totalCustomers: customers.count ?? 0,
        pending: byStatus.placed ?? 0,
        completed: byStatus.delivered ?? 0,
        cancelled: byStatus.cancelled ?? 0,
        recentOrders: recentOrders.data ?? [],
        lowStock: lowStock.data ?? [],
        monthly: Object.entries(monthly).slice(-6),
      };
    },
  });
  useRealtime(["orders", "products", "categories", "profiles"], () => q.refetch());

  const d = q.data;
  const cards = [
    { label: "Total Revenue", value: d ? inr(d.totalRevenue) : "…", icon: IndianRupee, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Total Orders", value: d?.totalOrders ?? "…", icon: ShoppingCart, tone: "bg-sky-50 text-sky-700" },
    { label: "Products", value: d ? `${d.publishedProducts} / ${d.totalProducts}` : "…", icon: Package, tone: "bg-violet-50 text-violet-700" },
    { label: "Categories", value: d?.totalCategories ?? "…", icon: FolderTree, tone: "bg-amber-50 text-amber-700" },
    { label: "Customers", value: d?.totalCustomers ?? "…", icon: Users, tone: "bg-rose-50 text-rose-700" },
    { label: "Pending", value: d?.pending ?? "…", icon: Clock, tone: "bg-amber-50 text-amber-700" },
    { label: "Completed", value: d?.completed ?? "…", icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Cancelled", value: d?.cancelled ?? "…", icon: XCircle, tone: "bg-rose-50 text-rose-700" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-slate-500">Live overview — updates in real time.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="admin-stat-card bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{c.label}</div>
              <span className={`grid h-9 w-9 place-items-center rounded-lg ${c.tone}`}>
                <c.icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 text-2xl font-semibold">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 lg:col-span-2">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="font-semibold">Recent Orders</div>
            <Link to="/aurona-console-9f2x7k/orders" className="text-xs text-sky-600 hover:underline">View all →</Link>
          </div>
          <div className="divide-y">
            {(d?.recentOrders ?? []).map((o) => (
              <Link key={o.id} to="/aurona-console-9f2x7k/orders/$id" params={{ id: o.id }} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                <div>
                  <div className="text-sm font-medium">{o.order_number}</div>
                  <div className="text-xs text-slate-500">{o.full_name} • {new Date(o.created_at).toLocaleDateString()}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{inr(Number(o.total))}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">{o.status}</div>
                </div>
              </Link>
            ))}
            {d && d.recentOrders.length === 0 && <div className="p-6 text-sm text-slate-500">No orders yet.</div>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-4 border-b border-slate-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <div className="font-semibold">Low Stock</div>
          </div>
          <div className="divide-y">
            {(d?.lowStock ?? []).map((p) => (
              <Link key={p.id} to="/aurona-console-9f2x7k/products/$id" params={{ id: p.id }} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                <div className="text-sm truncate max-w-[70%]">{p.name}</div>
                <div className="text-xs font-semibold text-rose-600">{p.stock} left</div>
              </Link>
            ))}
            {d && d.lowStock.length === 0 && <div className="p-6 text-sm text-slate-500">All stocked up.</div>}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-emerald-500" />
          <div className="font-semibold">Monthly Revenue (last 6)</div>
        </div>
        <div className="flex items-end gap-3 h-32">
          {(d?.monthly ?? []).map(([m, v]) => {
            const max = Math.max(...(d?.monthly ?? []).map(([, x]) => Number(x)), 1);
            const h = (Number(v) / max) * 100;
            return (
              <div key={m} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-gradient-to-t from-sky-500 to-sky-300 rounded-t" style={{ height: `${h}%` }} />
                <div className="text-[10px] text-slate-500">{m}</div>
                <div className="text-[10px] font-semibold">{inr(Number(v))}</div>
              </div>
            );
          })}
          {d && d.monthly.length === 0 && <div className="text-sm text-slate-500">No revenue data yet.</div>}
        </div>
      </div>
    </div>
  );
}
