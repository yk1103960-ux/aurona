import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Statuses at which a customer may still ask for a cancellation. */
const CANCELLABLE = new Set(["pending", "confirmed", "processing"]);

type OrderRow = {
  id: string;
  user_id: string | null;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total: number;
  awb_code: string | null;
  shipment_status: string | null;
};

function isDispatched(order: OrderRow) {
  const s = (order.shipment_status ?? "").toLowerCase();
  return (
    Boolean(order.awb_code) ||
    s.includes("picked") ||
    s.includes("transit") ||
    s.includes("shipped") ||
    s.includes("out for delivery") ||
    s.includes("delivered")
  );
}

/**
 * Customer-initiated cancellation REQUEST. The order is not cancelled here —
 * it stays live until an admin approves the request in the console. Requests
 * are only accepted while the order has not been handed to the courier.
 */
export const requestOrderCancellation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        reason: z.string().trim().min(3).max(300),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "id, user_id, order_number, status, payment_status, payment_method, total, awb_code, shipment_status",
      )
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("We couldn’t find that order on your account.");

    if (order.status === "cancelled" || order.status === "canceled") {
      return { ok: true as const, alreadyCancelled: true, pending: false };
    }
    if (!CANCELLABLE.has(order.status) || isDispatched(order as OrderRow)) {
      throw new Error(
        "This order has already been shipped, so it can no longer be cancelled. Please raise a return once it is delivered.",
      );
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // One open request per order — don't let a customer stack duplicates.
    const { data: existing } = await supabaseAdmin
      .from("return_requests")
      .select("id, status")
      .eq("order_id", order.id)
      .eq("kind", "cancellation")
      .in("status", ["requested", "approved", "refund_initiated"])
      .limit(1);
    if (existing && existing.length > 0) {
      return { ok: true as const, alreadyCancelled: false, pending: true };
    }

    const paid = order.payment_status === "paid";
    const { error: insErr } = await supabaseAdmin.from("return_requests").insert({
      order_id: order.id,
      user_id: order.user_id ?? userId,
      kind: "cancellation",
      status: "requested",
      reason: data.reason,
      refund_amount: paid ? Number(order.total) : 0,
      refund_method: paid ? order.payment_method : null,
    });
    if (insErr)
      throw new Error("We couldn’t submit your cancellation request. Please contact support.");

    return { ok: true as const, alreadyCancelled: false, pending: true };
  });

/**
 * Admin decision on a cancellation request. Approving is the only path that
 * actually cancels the order (and flags a refund for prepaid orders).
 */
export const decideOrderCancellation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        decision: z.enum(["approve", "reject"]),
        note: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertAdminPermission, writeAudit } = await import("./admin.server");
    const admin = await assertAdminPermission(context as never, "returns.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: req, error } = await supabaseAdmin
      .from("return_requests")
      .select("id, order_id, status, kind, refund_amount")
      .eq("id", data.requestId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!req) throw new Error("Cancellation request not found.");
    if (req.kind !== "cancellation") throw new Error("This request is not a cancellation.");
    if (req.status !== "requested") throw new Error("This request has already been decided.");

    const { data: result, error: decisionError } = await (supabaseAdmin as any).rpc(
      "admin_decide_cancellation",
      {
        _request_id: req.id,
        _decision: data.decision,
        _note: data.note ?? "",
        _actor_user_id: admin.userId,
      },
    );
    if (decisionError) throw new Error(decisionError.message);
    await writeAudit({
      actorUserId: admin.userId,
      actorEmail: admin.email,
      action: `return.cancellation_${data.decision}`,
      entityType: "return_request",
      entityId: req.id,
      after: result,
    });
    return {
      ok: true as const,
      cancelled: Boolean(result?.cancelled),
      refundPending: Boolean(result?.refund_pending),
    };
  });
