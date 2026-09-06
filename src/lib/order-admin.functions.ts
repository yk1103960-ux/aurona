import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminPermission, writeAudit } from "@/lib/admin.server";

const statuses = ["placed", "confirmed", "packed", "shipped", "out_for_delivery", "delivered", "cancelled"] as const;

export const adminListOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      search: z.string().trim().max(120).default(""),
      status: z.enum(statuses).or(z.literal("")).default(""),
      paymentStatus: z.string().trim().max(40).default(""),
      from: z.string().date().or(z.literal("")).default(""),
      to: z.string().date().or(z.literal("")).default(""),
      page: z.number().int().min(0).default(0),
      pageSize: z.number().int().min(10).max(100).default(50),
    }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdminPermission(context, "orders.view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const start = data.page * data.pageSize;
    let query = supabaseAdmin
      .from("orders")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(start, start + data.pageSize - 1);
    const safeSearch = data.search.replace(/[(),.%]/g, " ").trim();
    if (safeSearch) query = query.or(`order_number.ilike.%${safeSearch}%,full_name.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%`);
    if (data.status) query = query.eq("status", data.status);
    if (data.paymentStatus) query = query.eq("payment_status", data.paymentStatus);
    if (data.from) query = query.gte("created_at", `${data.from}T00:00:00.000Z`);
    if (data.to) {
      const exclusive = new Date(`${data.to}T00:00:00.000Z`);
      exclusive.setUTCDate(exclusive.getUTCDate() + 1);
      query = query.lt("created_at", exclusive.toISOString());
    }
    const { data: rows, count, error } = await query;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], count: count ?? 0 };
  });

export const adminTransitionOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      orderId: z.string().uuid(),
      status: z.enum(statuses),
      note: z.string().trim().max(500).default(""),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "orders.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before, error: beforeError } = await supabaseAdmin
      .from("orders")
      .select("status, order_number")
      .eq("id", data.orderId)
      .single();
    if (beforeError) throw new Error(beforeError.message);

    const { data: result, error } = await (supabaseAdmin as any).rpc("admin_transition_order", {
      _order_id: data.orderId,
      _to_status: data.status,
      _note: data.note || null,
      _actor_user_id: actor.userId,
    });
    if (error) throw new Error(error.message);

    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: "order.status_transition",
      entityType: "order",
      entityId: data.orderId,
      before: { status: before.status },
      after: { status: data.status, note: data.note || null, restocked: Boolean(result?.restocked) },
    });
    return result as { status: string; restocked: boolean };
  });
