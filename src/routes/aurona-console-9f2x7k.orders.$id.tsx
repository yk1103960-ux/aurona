import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Printer, RefreshCw, Truck } from "lucide-react";
import { pushOrderToShiprocket, syncOrderTracking } from "@/lib/admin.functions";
import { adminTransitionOrder } from "@/lib/order-admin.functions";

export const Route = createFileRoute("/aurona-console-9f2x7k/orders/$id")({
  component: OrderDetailAdmin,
});

const FLOW = ["placed", "confirmed", "packed", "shipped", "out_for_delivery", "delivered"] as const;
const NEXT_STATUS: Record<string, string[]> = {
  placed: ["confirmed", "cancelled"],
  confirmed: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
  delivered: [],
  cancelled: [],
};

function OrderDetailAdmin() {
  const { id } = useParams({ from: "/aurona-console-9f2x7k/orders/$id" });
  const qc = useQueryClient();
  const pushShiprocket = useServerFn(pushOrderToShiprocket);
  const syncTracking = useServerFn(syncOrderTracking);
  const transitionOrder = useServerFn(adminTransitionOrder);
  const [pushing, setPushing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [transitioning, setTransitioning] = useState(false);

  const q = useQuery({
    queryKey: ["admin-order", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*, order_items(*)").eq("id", id).single();
      if (error) throw error;
      const { data: history } = await (supabase as any).from("order_status_history").select("*").eq("order_id", id).order("created_at", { ascending: false });
      return { ...data, status_history: history ?? [] };
    },
  });

  const setStatus = async () => {
    if (!pendingStatus) return;
    if (pendingStatus === "cancelled" && note.trim().length < 3) return toast.error("Add a cancellation reason");
    setTransitioning(true);
    try {
      const result = await transitionOrder({ data: { orderId: id, status: pendingStatus as any, note } });
      toast.success(result.restocked ? "Order cancelled and stock restored" : `Status → ${result.status}`);
      setPendingStatus(null);
      setNote("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-order", id] }),
        qc.invalidateQueries({ queryKey: ["admin-orders"] }),
        qc.invalidateQueries({ queryKey: ["admin-inventory"] }),
      ]);
    } catch (e: any) {
      toast.error(e?.message || "Status update failed");
    } finally {
      setTransitioning(false);
    }
  };

  const doPush = async () => {
    setPushing(true);
    try {
      const r = await pushShiprocket({ data: { orderId: id } });
      toast.success(`${r.message} AWB ${r.awb ?? "—"}${r.courier ? ` · ${r.courier}` : ""}`);
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
    } catch (e: any) { toast.error(e?.message || "Shipment creation failed"); }
    setPushing(false);
  };

  const doSync = async () => {
    setSyncing(true);
    try {
      const r = await syncTracking({ data: { orderId: id } });
      toast.success(`Tracking updated${r.status ? ` · ${r.status}` : ""}`);
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
    } catch (e: any) { toast.error(e?.message || "Tracking sync failed"); }
    setSyncing(false);
  };


  const o = q.data;
  if (!o) return <div className="p-6 text-sm text-slate-500">Loading…</div>;

  return (
    <div className="space-y-4">
      <Link to="/aurona-console-9f2x7k/orders" className="text-sm text-slate-500 inline-flex items-center gap-1 hover:text-slate-900"><ArrowLeft className="w-4 h-4" /> Back to orders</Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{o.order_number}</h1>
          <p className="text-sm text-slate-500">Placed {new Date(o.created_at).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" /> Print / Invoice</Button>
          {!o.awb_code ? (
            <Button variant="outline" onClick={doPush} disabled={pushing}>
              <Truck className="w-4 h-4 mr-1" /> {pushing ? "Creating shipment…" : "Create shipment (Shiprocket)"}
            </Button>
          ) : (
            <>
              <span className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-md border border-emerald-200">
                AWB {o.awb_code}{o.courier_name ? ` · ${o.courier_name}` : ""}{o.shipment_status ? ` · ${o.shipment_status}` : ""}
              </span>
              <Button variant="outline" onClick={doSync} disabled={syncing}>
                <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? "animate-spin" : ""}`} /> {syncing ? "Syncing…" : "Sync tracking"}
              </Button>
            </>
          )}

          <select value="" disabled={(NEXT_STATUS[o.status] ?? []).length === 0} onChange={(e) => setPendingStatus(e.target.value)} className="h-10 border rounded-md px-3 text-sm bg-white">
            <option value="">{(NEXT_STATUS[o.status] ?? []).length ? "Advance status…" : `Status: ${o.status}`}</option>
            {(NEXT_STATUS[o.status] ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="p-4 border-b border-slate-100 font-semibold">Items</div>
            <div className="divide-y">
              {(o.order_items ?? []).map((it) => {
                const attributes = it.variant_attributes && typeof it.variant_attributes === "object" && !Array.isArray(it.variant_attributes)
                  ? Object.entries(it.variant_attributes).filter((entry): entry is [string, string] => typeof entry[1] === "string")
                  : [];
                return <div key={it.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{it.product_name}</div>
                    {it.sku && <div className="text-xs font-mono text-slate-600">SKU {it.sku}</div>}
                    {attributes.length > 0 && (
                      <div className="text-xs text-slate-500">{attributes.map(([key, value]) => `${key}: ${value}`).join(" · ")}</div>
                    )}
                    <div className="text-xs text-slate-500">Qty {it.quantity} × {inr(Number(it.price))}</div>
                  </div>
                  <div className="font-semibold">{inr(Number(it.price) * it.quantity)}</div>
                </div>;
              })}
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
            {o.status === "cancelled" && <div className="mt-3 text-sm font-medium text-rose-600">Cancelled</div>}
            {(o.status_history ?? []).length > 0 && (
              <div className="mt-4 border-t pt-3 space-y-2">
                {(o.status_history ?? []).map((entry: any) => (
                  <div key={entry.id} className="text-xs">
                    <div className="font-medium">{entry.from_status} → {entry.to_status}</div>
                    <div className="text-slate-500">{new Date(entry.created_at).toLocaleString()}{entry.note ? ` · ${entry.note}` : ""}</div>
                  </div>
                ))}
              </div>
            )}
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
            <div className="text-xs text-slate-500 uppercase">{o.payment_status}</div>
          </div>
        </div>
      </div>

      <Dialog open={!!pendingStatus} onOpenChange={(open) => !open && setPendingStatus(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{pendingStatus === "cancelled" ? "Cancel order" : `Move order to ${pendingStatus}`}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="status-note">{pendingStatus === "cancelled" ? "Reason (required)" : "Internal note (optional)"}</Label>
            <Textarea id="status-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={pendingStatus === "cancelled" ? "Why is this order being cancelled?" : "Add context for the audit trail"} />
            {pendingStatus === "cancelled" && <p className="text-xs text-slate-500">Cancellation restores all SKU stock and reverses coupon usage atomically.</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingStatus(null)}>Back</Button>
            <Button variant={pendingStatus === "cancelled" ? "destructive" : "default"} disabled={transitioning} onClick={setStatus}>{transitioning ? "Saving…" : "Confirm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-slate-500">{label}</span><span>{value}</span></div>;
}
