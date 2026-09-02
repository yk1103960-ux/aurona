import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

/** Live view of carts that have been sitting untouched, with reminder history. */
export const adminListAbandonedCarts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: items }, { data: reminders }, { data: profiles }, { data: products }] = await Promise.all([
      supabaseAdmin.from("cart_items").select("user_id, product_id, quantity, created_at"),
      supabaseAdmin.from("cart_reminders").select("user_id, stage, coupon_code, sent_at"),
      supabaseAdmin.from("profiles").select("id, full_name, phone, account_type"),
      supabaseAdmin.from("products").select("id, name, price"),
    ]);

    const pMap = new Map((products ?? []).map((p) => [p.id, p]));
    const profMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const remByUser = new Map<string, { stage: string; sent_at: string; coupon_code: string | null }[]>();
    for (const r of reminders ?? []) {
      remByUser.set(r.user_id, [...(remByUser.get(r.user_id) ?? []), r as never]);
    }

    const byUser = new Map<string, { product_id: string; quantity: number; created_at: string }[]>();
    for (const it of items ?? []) {
      if (!it.user_id || !it.product_id) continue;
      byUser.set(it.user_id, [
        ...(byUser.get(it.user_id) ?? []),
        { product_id: it.product_id, quantity: it.quantity ?? 1, created_at: it.created_at },
      ]);
    }

    return [...byUser.entries()]
      .map(([userId, lines]) => {
        const lastActivity = new Date(Math.max(...lines.map((l) => new Date(l.created_at).getTime())));
        const value = lines.reduce((s, l) => s + Number(pMap.get(l.product_id)?.price ?? 0) * l.quantity, 0);
        const rem = (remByUser.get(userId) ?? []).sort((a, b) => (a.sent_at < b.sent_at ? 1 : -1));
        const prof = profMap.get(userId);
        return {
          userId,
          customerName: prof?.full_name ?? null,
          phone: prof?.phone ?? null,
          accountType: prof?.account_type ?? "customer",
          itemCount: lines.reduce((s, l) => s + l.quantity, 0),
          cartValue: Math.round(value),
          productNames: lines.map((l) => pMap.get(l.product_id)?.name ?? "Item").slice(0, 4),
          lastActivityAt: lastActivity.toISOString(),
          hoursIdle: Math.floor((Date.now() - lastActivity.getTime()) / 3_600_000),
          lastReminderStage: rem[0]?.stage ?? null,
          lastReminderAt: rem[0]?.sent_at ?? null,
          couponCode: rem.find((r) => r.coupon_code)?.coupon_code ?? null,
        };
      })
      .sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? -1 : 1));
  });

/** Manually trigger the recovery pass (same logic the cron job runs). */
export const adminRunCartReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ limit: z.number().min(1).max(200).default(50) }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { runCartReminders } = await import("./cart-reminders.server");
    const result = await runCartReminders(data.limit);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: context.userId,
      action: "cart_reminders.run",
      entity_type: "cart_reminders",
      after: result as never,
    } as never);
    return result;
  });
