import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { inr } from "@/lib/format";
import { RotateCcw, Search } from "lucide-react";
import { decideOrderCancellation } from "@/lib/orders.functions";

const db = supabase as any;

export const Route = createFileRoute("/aurona-console-9f2x7k/returns")({
  component: AdminReturns,
});


const STATUSES = [
  "requested",
  "approved",
  "rejected",
  "pickup_scheduled",
  "picked_up",
  "received",
  "refund_initiated",
  "refunded",
  "completed",
  "cancelled",
] as const;

const KIND_LABEL: Record<string, string> = {
  return: "Return",
  replacement: "Replacement",
  cancellation: "Cancellation",
};

function AdminReturns() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const rows = useQuery({
    queryKey: ["admin-returns"],
    queryFn: async () => {
      const { data, error } = await db
        .from("return_requests")
        .select("*, return_request_items(*), orders(order_number, full_name, phone, total, payment_method, payment_status)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  useRealtime(["return_requests"], () => qc.invalidateQueries({ queryKey: ["admin-returns"] }));

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (rows.data ?? []).filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!term) return true;
      return (
        String(r.orders?.order_number ?? "").toLowerCase().includes(term) ||
        String(r.orders?.full_name ?? "").toLowerCase().includes(term) ||
        String(r.reason ?? "").toLowerCase().includes(term)
      );
    });
  }, [rows.data, q, filter]);

  const pending = (rows.data ?? []).filter((r) => r.status === "requested").length;
  const refundDue = (rows.data ?? [])
    .filter((r) => ["approved", "received", "refund_initiated"].includes(r.status))
    .reduce((s, r) => s + Number(r.refund_amount || 0), 0);

  const patch = async (id: string, values: Record<string, unknown>) => {
    const { error } = await db.from("return_requests").update(values).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Request updated");
    qc.invalidateQueries({ queryKey: ["admin-returns"] });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <RotateCcw className="h-5 w-5 text-sky-600" /> Returns & Refunds
          </h1>
          <p className="text-sm text-slate-500">
            {pending} awaiting review · {inr(refundDue)} refunds in progress
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search order, customer, reason"
              className="h-10 w-72 bg-white pl-9"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-10 rounded-md border bg-white px-3 text-sm"
          >
            <option value="all">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {rows.isLoading ? (
        <div className="h-24 animate-pulse rounded-xl bg-white" />
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No return, replacement or cancellation requests match this view.
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <Card key={r.id} r={r} patch={patch} />
          ))}
        </div>
      )}
    </div>
  );
}

function Card({ r, patch }: { r: any; patch: (id: string, v: Record<string, unknown>) => Promise<unknown> }) {
  const qc = useQueryClient();
  const [note, setNote] = useState<string>(r.admin_note ?? "");
  const [amount, setAmount] = useState<string>(String(r.refund_amount ?? 0));
  const [reference, setReference] = useState<string>(r.refund_reference ?? "");
  const [busy, setBusy] = useState(false);
  const decideCancellation = useServerFn(decideOrderCancellation);

  const isCancellation = r.kind === "cancellation";

  const decide = (status: string) =>
    patch(r.id, {
      status,
      admin_note: note.trim() || null,
      refund_amount: Number(amount) || 0,
      refund_reference: reference.trim() || null,
      reviewed_at: new Date().toISOString(),
    });

  /** Cancellations must go through the server fn — it is what actually cancels the order. */
  const rule = async (decision: "approve" | "reject") => {
    setBusy(true);
    try {
      const res = await decideCancellation({
        data: { requestId: r.id, decision, note: note.trim() || undefined },
      });
      toast.success(
        decision === "reject"
          ? "Cancellation rejected — the order stays active."
          : res.refundPending
            ? "Order cancelled. Refund marked as initiated."
            : "Order cancelled successfully.",
      );
      qc.invalidateQueries({ queryKey: ["admin-returns"] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update this request.");
    } finally {
      setBusy(false);
    }
  };


  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">
            {KIND_LABEL[r.kind] ?? r.kind} · Order #{r.orders?.order_number ?? "—"}
          </div>
          <div className="text-xs text-slate-500">
            {r.orders?.full_name} · {r.orders?.phone} · {new Date(r.created_at).toLocaleString("en-IN")}
          </div>
          <div className="mt-1 text-xs text-slate-600">
            Reason: <b>{r.reason}</b>
            {r.comments ? ` — ${r.comments}` : ""}
          </div>
        </div>
        <div className="text-right text-xs">
          <span className="rounded-full bg-sky-50 px-3 py-1 font-bold uppercase tracking-widest text-sky-700">
            {r.status}
          </span>
          <div className="mt-1 text-slate-500">
            Order total {inr(Number(r.orders?.total ?? 0))} · {String(r.orders?.payment_method ?? "").toUpperCase()}
          </div>
        </div>
      </div>

      {(r.return_request_items ?? []).length > 0 && (
        <ul className="mt-3 divide-y rounded-lg border border-slate-100">
          {r.return_request_items.map((i: any) => (
            <li key={i.id} className="flex justify-between px-3 py-2 text-xs">
              <span>{i.product_name} × {i.quantity}</span>
              <span className="font-medium">{inr(Number(i.price) * i.quantity)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="text-xs text-slate-500">
          Refund amount
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 h-9" inputMode="decimal" />
        </label>
        <label className="text-xs text-slate-500">
          Refund reference / UTR
          <Input value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1 h-9" />
        </label>
        <label className="text-xs text-slate-500">
          Internal / customer note
          <Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 h-9" maxLength={500} />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {r.status === "requested" && (
          <>
            <Button size="sm" onClick={() => decide("approved")}>Approve</Button>
            <Button size="sm" variant="outline" onClick={() => decide("rejected")}>Reject</Button>
          </>
        )}
        {r.kind !== "cancellation" && (
          <>
            <Button size="sm" variant="outline" onClick={() => decide("pickup_scheduled")}>Schedule pickup</Button>
            <Button size="sm" variant="outline" onClick={() => decide("picked_up")}>Picked up</Button>
            <Button size="sm" variant="outline" onClick={() => decide("received")}>Received</Button>
          </>
        )}
        {r.kind !== "replacement" && (
          <>
            <Button size="sm" variant="outline" onClick={() => decide("refund_initiated")}>Refund initiated</Button>
            <Button size="sm" variant="outline" onClick={() => decide("refunded")}>Mark refunded</Button>
          </>
        )}
        <Button size="sm" variant="outline" onClick={() => decide("completed")}>Complete</Button>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          onClick={() =>
            patch(r.id, { admin_note: note.trim() || null, refund_amount: Number(amount) || 0, refund_reference: reference.trim() || null })
          }
        >
          Save details
        </Button>
      </div>
    </div>
  );
}
