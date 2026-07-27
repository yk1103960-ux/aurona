import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Printer } from "lucide-react";

export const Route = createFileRoute("/admin/orders/$id")({
  component: OrderDetailAdmin,
});

const FLOW = ["placed", "confirmed", "packed", "shipped", "out_for_delivery", "delivered"] as const;

function OrderDetailAdmin() {
  const { id } = useParams({ from: "/admin/orders/$id" });
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["admin-order", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*, order_items(*)").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const setStatus = async (s: string) => {
    const { error } = await supabase.from("orders").update({ status: s }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Status → ${s}`);
    qc.invalidateQueries({ queryKey: ["admin-order", id] });
  };

  const o = q.data;
  if (!o) return <div className="p-6 text-sm text-slate-500">Loading…</div>;

  return (
    <div className="space-y-4">
      <Link to="/admin/orders" className="text-sm text-slate-500 inline-flex items-center gap-1 hover:text-slate-900"><ArrowLeft className="w-4 h-4" /> Back to orders</Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{o.order_number}</h1>
          <p className="text-sm text-slate-500">Placed {new Date(o.created_at).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" /> Print / Invoice</Button>
          <select value={o.status} onChange={(e) => setStatus(e.target.value)} className="h-10 border rounded-md px-3 text-sm bg-white">
            {FLOW.map((s) => <option key={s} value={s}>{s}</option>)}
            <option value="cancelled">cancelled</option>
          </select>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="p-4 border-b border-slate-100 font-semibold">Items</div>
            <div className="divide-y">
              {(o.order_items ?? []).map((it: { id: string; product_name: string; quantity: number; price: number }) => (
                <div key={it.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{it.product_name}</div>
                    <div className="text-xs text-slate-500">Qty {it.quantity} × {inr(Number(it.price))}</div>
                  </div>
                  <div className="font-semibold">{inr(Number(it.price) * it.quantity)}</div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-slate-100 space-y-1 text-sm">
              <Row label="Subtotal" value={inr(Number(o.subtotal))} />
              <Row label="Shipping" value={inr(Number(o.shipping))} />
              <Row label="Discount" value={`− ${inr(Number(o.discount))}`} />
              <div className="border-t pt-2 flex justify-between font-semibold text-base"><span>Total</span><span>{inr(Number(o.total))}</span></div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="font-semibold mb-3">Status Timeline</div>
            <div className="flex items-center gap-2 overflow-x-auto">
              {FLOW.map((s, i) => {
                const idx = FLOW.indexOf(o.status as typeof FLOW[number]);
                const done = idx >= i;
                return (
                  <div key={s} className={`flex-1 min-w-24 text-center ${done ? "text-emerald-600" : "text-slate-400"}`}>
                    <div className={`w-3 h-3 rounded-full mx-auto ${done ? "bg-emerald-500" : "bg-slate-200"}`} />
                    <div className="text-[10px] mt-1 uppercase tracking-wider">{s}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="font-semibold mb-2">Customer</div>
            <div className="text-sm">{o.full_name}</div>
            <div className="text-sm text-slate-500">{o.phone}</div>
            {o.email && <div className="text-sm text-slate-500">{o.email}</div>}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="font-semibold mb-2">Shipping Address</div>
            <div className="text-sm whitespace-pre-line">{o.address}</div>
            <div className="text-sm">{o.city}, {o.state} — {o.pincode}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="font-semibold mb-2">Payment</div>
            <div className="text-sm uppercase">{o.payment_method}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-slate-500">{label}</span><span>{value}</span></div>;
}
