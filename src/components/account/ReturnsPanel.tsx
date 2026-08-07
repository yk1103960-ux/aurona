import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { inr } from "@/lib/format";
import { RotateCcw, PackageX, RefreshCcw, XCircle, Clock, CheckCircle2, IndianRupee } from "lucide-react";

const db = supabase as any;

export type ReturnKind = "return" | "replacement" | "cancellation";

const KIND_LABEL: Record<ReturnKind, string> = {
  return: "Return & refund",
  replacement: "Replacement",
  cancellation: "Order cancellation",
};

const STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  approved: "Approved",
  rejected: "Rejected",
  pickup_scheduled: "Pickup scheduled",
  picked_up: "Picked up",
  received: "Received at warehouse",
  refund_initiated: "Refund initiated",
  refunded: "Refunded",
  completed: "Completed",
  cancelled: "Cancelled",
};

const RETURN_REASONS = [
  "Damaged on arrival",
  "Wrong item delivered",
  "Not working / defective",
  "Missing parts or accessories",
  "Different from description",
  "No longer needed",
];

const CANCEL_REASONS = [
  "Ordered by mistake",
  "Found a better price",
  "Delivery taking too long",
  "Changed my mind",
  "Duplicate order",
];

const RETURN_WINDOW_DAYS = 7;

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/** Cancellable until it ships; returnable for 7 days after delivery. */
export function orderEligibility(order: any): { kinds: ReturnKind[]; note: string } {
  const status = String(order.status ?? "");
  if (["cancelled"].includes(status)) return { kinds: [], note: "This order is cancelled." };
  if (status === "delivered") {
    const d = daysSince(order.created_at);
    const left = RETURN_WINDOW_DAYS - daysSince(order.delivered_at ?? order.created_at);
    if (left <= 0) return { kinds: [], note: `Return window closed (${d} days since order).` };
    return { kinds: ["return", "replacement"], note: `${left} day${left === 1 ? "" : "s"} left to raise a return or replacement.` };
  }
  if (["placed", "confirmed", "packed"].includes(status)) {
    return { kinds: ["cancellation"], note: "You can cancel this order until it is handed to the courier." };
  }
  return { kinds: [], note: "This order is already in transit — contact support for help." };
}

export function ReturnsPanel({ orders, loading }: { orders: any[]; loading: boolean }) {
  const qc = useQueryClient();
  const [openOrder, setOpenOrder] = useState<string | null>(null);

  const requests = useQuery({
    queryKey: ["my-returns"],
    queryFn: async () => {
      const { data, error } = await db
        .from("return_requests")
        .select("*, return_request_items(*), return_events(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const existingByOrder = useMemo(() => {
    const m = new Map<string, any>();
    (requests.data ?? []).forEach((r) => {
      if (!m.has(r.order_id)) m.set(r.order_id, r);
    });
    return m;
  }, [requests.data]);

  const eligible = orders.filter((o) => orderEligibility(o).kinds.length > 0 && !existingByOrder.has(o.id));

  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-display text-2xl">Returns, replacements & cancellations</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cancel before dispatch, or raise a return within {RETURN_WINDOW_DAYS} days of delivery.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mt-5 h-24 animate-pulse rounded-2xl bg-surface" />
        ) : eligible.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-border bg-surface p-6 text-sm text-muted-foreground">
            No orders are currently eligible for a new request.
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {eligible.map((o) => {
              const el = orderEligibility(o);
              return (
                <div key={o.id} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">Order #{o.order_number}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString("en-IN")} · {inr(o.total)} · {el.note}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="gap-2 rounded-full"
                      onClick={() => setOpenOrder(openOrder === o.id ? null : o.id)}
                    >
                      <RotateCcw className="h-4 w-4" />
                      {openOrder === o.id ? "Close" : el.kinds[0] === "cancellation" ? "Cancel order" : "Return / replace"}
                    </Button>
                  </div>
                  {openOrder === o.id && (
                    <RequestForm
                      order={o}
                      kinds={el.kinds}
                      onDone={() => {
                        setOpenOrder(null);
                        qc.invalidateQueries({ queryKey: ["my-returns"] });
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-display text-2xl">My requests</h2>
        {requests.isLoading ? (
          <div className="mt-5 h-24 animate-pulse rounded-2xl bg-surface" />
        ) : (requests.data ?? []).length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-border bg-surface p-6 text-sm text-muted-foreground">
            You haven’t raised any returns, replacements or cancellations yet.
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {requests.data!.map((r) => (
              <RequestCard key={r.id} r={r} orders={orders} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RequestForm({ order, kinds, onDone }: { order: any; kinds: ReturnKind[]; onDone: () => void }) {
  const [kind, setKind] = useState<ReturnKind>(kinds[0]!);
  const [reason, setReason] = useState("");
  const [comments, setComments] = useState("");
  const items: any[] = order.order_items ?? [];
  const [picked, setPicked] = useState<Record<string, boolean>>(
    Object.fromEntries(items.map((i) => [i.id, true])),
  );

  const reasons = kind === "cancellation" ? CANCEL_REASONS : RETURN_REASONS;
  const chosen = kind === "cancellation" ? items : items.filter((i) => picked[i.id]);
  const amount =
    kind === "cancellation"
      ? Number(order.total)
      : chosen.reduce((s, i) => s + Number(i.price) * i.quantity, 0);

  const submit = useMutation({
    mutationFn: async () => {
      if (!reason) throw new Error("Please choose a reason");
      if (chosen.length === 0) throw new Error("Select at least one item");
      const { data: req, error } = await db
        .from("return_requests")
        .insert({
          order_id: order.id,
          user_id: order.user_id,
          kind,
          reason,
          comments: comments.trim() || null,
          refund_amount: kind === "replacement" ? 0 : amount,
          refund_method: order.payment_method === "cod" ? "bank_transfer" : "original_payment_method",
        })
        .select("id")
        .single();
      if (error) throw error;
      const rows = chosen.map((i) => ({
        request_id: req.id,
        order_item_id: i.id,
        product_name: i.product_name,
        price: i.price,
        quantity: i.quantity,
      }));
      const { error: e2 } = await db.from("return_request_items").insert(rows);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Request submitted — our team will review it shortly");
      onDone();
    },
    onError: (e: any) => toast.error(e.message ?? "Could not submit request"),
  });

  return (
    <div className="mt-5 space-y-5 border-t border-border pt-5">
      {kinds.length > 1 && (
        <div>
          <Label className="text-xs">Request type</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                  kind === k ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-surface"
                }`}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
      )}

      {kind !== "cancellation" && (
        <div>
          <Label className="text-xs">Items to {kind === "replacement" ? "replace" : "return"}</Label>
          <div className="mt-2 space-y-2">
            {items.map((i) => (
              <label key={i.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 text-sm">
                <Checkbox
                  checked={!!picked[i.id]}
                  onCheckedChange={(v) => setPicked((p) => ({ ...p, [i.id]: !!v }))}
                />
                <span className="min-w-0 flex-1 line-clamp-1">{i.product_name} × {i.quantity}</span>
                <span className="font-semibold">{inr(Number(i.price) * i.quantity)}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <Label className="text-xs">Reason</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {reasons.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                reason === r ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-surface"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="ret-comments" className="text-xs">Additional details (optional)</Label>
        <Textarea
          id="ret-comments"
          value={comments}
          maxLength={1000}
          onChange={(e) => setComments(e.target.value)}
          placeholder="Tell us what went wrong so we can resolve it faster."
          className="mt-2"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface p-4">
        <div className="text-sm">
          {kind === "replacement" ? (
            <span className="text-muted-foreground">A free replacement will be shipped after inspection.</span>
          ) : (
            <>
              <span className="text-muted-foreground">Estimated refund</span>{" "}
              <span className="font-semibold">{inr(amount)}</span>
            </>
          )}
        </div>
        <Button className="rounded-full" disabled={submit.isPending} onClick={() => submit.mutate()}>
          {submit.isPending ? "Submitting…" : "Submit request"}
        </Button>
      </div>
    </div>
  );
}

function statusIcon(s: string) {
  if (s === "rejected" || s === "cancelled") return XCircle;
  if (s === "refunded" || s === "completed") return CheckCircle2;
  if (s === "refund_initiated") return IndianRupee;
  if (s === "requested") return Clock;
  return RefreshCcw;
}

function RequestCard({ r, orders }: { r: any; orders: any[] }) {
  const order = orders.find((o) => o.id === r.order_id);
  const Icon = statusIcon(r.status);
  const events = [...(r.return_events ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const closed = ["rejected", "cancelled", "completed", "refunded"].includes(r.status);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`grid h-9 w-9 place-items-center rounded-full ${closed ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-semibold">
              {KIND_LABEL[r.kind as ReturnKind]} · Order #{order?.order_number ?? "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(r.created_at).toLocaleString("en-IN")} · {r.reason}
            </div>
          </div>
        </div>
        <div className="text-right">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
            {STATUS_LABEL[r.status] ?? r.status}
          </span>
          {Number(r.refund_amount) > 0 && (
            <div className="mt-1 text-xs text-muted-foreground">Refund {inr(Number(r.refund_amount))}</div>
          )}
        </div>
      </div>

      {(r.return_request_items ?? []).length > 0 && (
        <ul className="mt-3 space-y-1">
          {r.return_request_items.map((i: any) => (
            <li key={i.id} className="flex justify-between text-xs text-muted-foreground">
              <span className="line-clamp-1">{i.product_name} × {i.quantity}</span>
              <span>{inr(Number(i.price) * i.quantity)}</span>
            </li>
          ))}
        </ul>
      )}

      {r.admin_note && (
        <p className="mt-3 rounded-xl bg-surface p-3 text-xs text-muted-foreground">
          <b>Aurona team:</b> {r.admin_note}
        </p>
      )}

      {events.length > 0 && (
        <ol className="mt-4 space-y-2 border-l border-border pl-4">
          {events.map((e) => (
            <li key={e.id} className="relative text-xs">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
              <span className="font-semibold">{STATUS_LABEL[e.status] ?? e.status}</span>
              {e.note ? <span className="text-muted-foreground"> — {e.note}</span> : null}
              <span className="ml-2 text-muted-foreground">{new Date(e.created_at).toLocaleString("en-IN")}</span>
            </li>
          ))}
        </ol>
      )}

      {r.refund_reference && (
        <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600">
          <PackageX className="h-3.5 w-3.5" /> Refund reference: {r.refund_reference}
        </div>
      )}
    </div>
  );
}
