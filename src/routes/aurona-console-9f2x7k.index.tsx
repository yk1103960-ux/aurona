import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useAdmin";
import { inr } from "@/lib/format";
import { dashboardOrderSummary, readDashboardPages } from "@/lib/admin-dashboard-data";
import { Button } from "@/components/ui/button";
import {
  Package,
  ShoppingCart,
  Users,
  IndianRupee,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  FolderTree,
  RefreshCw,
  Plus,
  Boxes,
  ArrowUpRight,
} from "lucide-react";

export const Route = createFileRoute("/aurona-console-9f2x7k/")({
  component: AdminDashboard,
});

const shortcuts = [
  {
    label: "Add product",
    description: "Create a family, then add its variations",
    to: "/aurona-console-9f2x7k/products/new",
    icon: Plus,
  },
  {
    label: "Edit products & prices",
    description: "Customer, retailer and distributor pricing",
    to: "/aurona-console-9f2x7k/products/master",
    icon: Package,
  },
  {
    label: "Manage SKU stock",
    description: "Adjust individual SKUs within each family",
    to: "/aurona-console-9f2x7k/inventory",
    icon: Boxes,
  },
  {
    label: "Process orders",
    description: "Review payments and fulfilment",
    to: "/aurona-console-9f2x7k/orders",
    icon: ShoppingCart,
  },
] as const;

function AdminDashboard() {
  const q = useQuery({
    queryKey: ["admin-dashboard"],
    staleTime: 30_000,
    queryFn: async () => {
      const cutoff = new Date().toISOString();
      const [allOrders, families, published, categories, customers, recentOrders, variants] =
        await Promise.all([
          readDashboardPages((from, to) =>
            supabase
              .from("orders")
              .select("status,total,created_at", { count: "exact" })
              .lte("created_at", cutoff)
              .order("id")
              .range(from, to),
          ),
          supabase.from("product_families").select("id", { count: "exact", head: true }),
          supabase
            .from("product_families")
            .select("id", { count: "exact", head: true })
            .filter("is_published", "eq", true),
          supabase.from("categories").select("id", { count: "exact", head: true }),
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase
            .from("orders")
            .select("id, order_number, full_name, total, status, created_at")
            .order("created_at", { ascending: false })
            .limit(8),
          readDashboardPages((from, to) =>
            supabase
              .from("product_variants")
              .select("id,family_id,sku,stock,reserved_stock,low_stock_threshold", {
                count: "exact",
              })
              .eq("is_active", true)
              .order("id")
              .range(from, to),
          ),
        ]);
      for (const result of [families, published, categories, customers, recentOrders]) {
        if (result.error) throw new Error(result.error.message);
      }
      for (const result of [families, published, categories, customers]) {
        if (result.count === null) throw new Error("A dashboard count is unavailable. Retry.");
      }
      const { orderValue, statuses: byStatus, monthly } = dashboardOrderSummary(allOrders);
      return {
        totalOrders: allOrders.length,
        totalRevenue: orderValue,
        totalProducts: families.count!,
        publishedProducts: published.count!,
        totalCategories: categories.count ?? 0,
        totalCustomers: customers.count ?? 0,
        pending: byStatus.placed ?? 0,
        completed: byStatus.delivered ?? 0,
        cancelled: byStatus.cancelled ?? 0,
        recentOrders: recentOrders.data ?? [],
        lowStock: variants
          .map((row) => ({ ...row, available: row.stock - row.reserved_stock }))
          .filter((row) => row.available <= row.low_stock_threshold)
          .sort((a, b) => a.available - b.available || a.sku.localeCompare(b.sku))
          .slice(0, 8),
        monthly: monthly.map((row) => [row.label, row.value] as const),
      };
    },
  });
  const realtime = useRealtime(
    ["orders", "product_families", "product_variants", "categories", "profiles"],
    () => {
      void q.refetch();
    },
  );

  const d = q.data;
  const cards = [
    {
      label: "Order Value",
      value: d ? inr(d.totalRevenue) : "…",
      icon: IndianRupee,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Total Orders",
      value: d?.totalOrders ?? "…",
      icon: ShoppingCart,
      tone: "bg-sky-50 text-sky-700",
    },
    {
      label: "Published / All Families",
      value: d ? `${d.publishedProducts} / ${d.totalProducts}` : "…",
      icon: Package,
      tone: "bg-violet-50 text-violet-700",
    },
    {
      label: "Categories",
      value: d?.totalCategories ?? "…",
      icon: FolderTree,
      tone: "bg-amber-50 text-amber-700",
    },
    {
      label: "Customers",
      value: d?.totalCustomers ?? "…",
      icon: Users,
      tone: "bg-rose-50 text-rose-700",
    },
    { label: "Pending", value: d?.pending ?? "…", icon: Clock, tone: "bg-amber-50 text-amber-700" },
    {
      label: "Completed",
      value: d?.completed ?? "…",
      icon: CheckCircle2,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Cancelled",
      value: d?.cancelled ?? "…",
      icon: XCircle,
      tone: "bg-rose-50 text-rose-700",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Your daily workspace for products, stock and orders.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span role="status" className="text-xs text-slate-500">
            {realtime === "live"
              ? "Realtime connected"
              : realtime === "connecting"
                ? "Connecting live updates…"
                : "Live updates unavailable"}
            {q.dataUpdatedAt > 0 && ` · Updated ${new Date(q.dataUpdatedAt).toLocaleTimeString()}`}
          </span>
          <Button variant="outline" disabled={q.isFetching} onClick={() => q.refetch()}>
            <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      <nav aria-label="Common admin tasks" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {shortcuts.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
          >
            <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                {item.label}
                <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
            </div>
          </Link>
        ))}
      </nav>
      {q.isError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        >
          The overview could not be refreshed.{" "}
          {d
            ? "The figures below are from the last successful load."
            : "No figures are shown until the database responds successfully."}{" "}
          Use Refresh to retry.
        </div>
      )}
      {q.isLoading && (
        <p role="status" className="text-sm text-slate-500">
          Loading the overview…
        </p>
      )}
      <p className="text-xs text-slate-500">
        All-time counts. Order value excludes cancelled orders; it is not net paid revenue.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-busy={q.isLoading}>
        {cards.map((c) => (
          <div
            key={c.label}
            className="admin-stat-card bg-white rounded-xl border border-slate-200 p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {c.label}
              </div>
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${c.tone}`}>
                <c.icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 break-words text-2xl font-semibold">
              {q.isError && !d ? "—" : c.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 lg:col-span-2">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="font-semibold">Recent Orders</div>
            <Link
              to="/aurona-console-9f2x7k/orders"
              className="text-xs text-sky-600 hover:underline"
            >
              View all →
            </Link>
          </div>
          <div className="divide-y">
            {(d?.recentOrders ?? []).map((o) => (
              <Link
                key={o.id}
                to="/aurona-console-9f2x7k/orders/$id"
                params={{ id: o.id }}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
              >
                <div>
                  <div className="text-sm font-medium">{o.order_number}</div>
                  <div className="text-xs text-slate-500">
                    {o.full_name} • {new Date(o.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{inr(Number(o.total))}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">
                    {o.status}
                  </div>
                </div>
              </Link>
            ))}
            {d && d.recentOrders.length === 0 && (
              <div className="p-6 text-sm text-slate-500">No orders yet.</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-4 border-b border-slate-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <div className="font-semibold">Low-stock SKUs</div>
          </div>
          <p className="px-4 pt-3 text-xs text-slate-500">
            Available stock after reservations, using each SKU’s threshold.
          </p>
          <div className="divide-y">
            {(d?.lowStock ?? []).map((p) => (
              <Link
                key={p.id}
                to="/aurona-console-9f2x7k/products/$id/variations"
                params={{ id: p.family_id }}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
              >
                <div className="min-w-0 break-all font-mono text-sm">{p.sku}</div>
                <div className="shrink-0 text-xs font-semibold text-rose-600">
                  {p.available} available
                </div>
              </Link>
            ))}
            {d && d.lowStock.length === 0 && (
              <div className="p-6 text-sm text-slate-500">All stocked up.</div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-emerald-500" />
          <div className="font-semibold">Monthly order value (last 6 calendar months, UTC)</div>
        </div>
        <div className="overflow-x-auto">
          <div className="flex min-w-[440px] items-end gap-3">
            {(d?.monthly ?? []).map(([m, v]) => {
              const max = Math.max(...(d?.monthly ?? []).map(([, x]) => Number(x)), 1);
              const h = (Number(v) / max) * 100;
              return (
                <div key={m} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="flex h-32 w-full items-end rounded bg-slate-50"
                    aria-hidden="true"
                  >
                    <div
                      className="w-full bg-sky-600 rounded-t"
                      style={{ height: `${Math.max(0, h)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-500">{m}</div>
                  <div className="text-[10px] font-semibold">{inr(Number(v))}</div>
                </div>
              );
            })}
            {d && d.monthly.length === 0 && (
              <div className="text-sm text-slate-500">No order data yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
