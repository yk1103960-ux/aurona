import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminPermission, writeAudit } from "@/lib/admin.server";

const CouponInput = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/),
  description: z.string().trim().max(500).nullable(),
  type: z.enum(["flat", "percentage"]),
  value: z.number().finite().positive(),
  min_order_value: z.number().finite().min(0),
  max_discount: z.number().finite().positive().nullable(),
  starts_at: z.string().datetime().nullable(),
  expires_at: z.string().datetime().nullable(),
  usage_limit: z.number().int().positive().nullable(),
  per_user_limit: z.number().int().positive(),
  eligible_roles: z.array(z.enum(["customer", "retailer", "distributor"])).min(1),
  active: z.boolean(),
}).superRefine((value, ctx) => {
  if (value.type === "percentage" && value.value > 100) ctx.addIssue({ code: "custom", message: "Percentage cannot exceed 100", path: ["value"] });
  if (value.starts_at && value.expires_at && value.starts_at >= value.expires_at) ctx.addIssue({ code: "custom", message: "Expiry must be after the start date", path: ["expires_at"] });
});

export const adminSaveCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CouponInput.parse(input))
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "coupons.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const id = data.id;
    let before: unknown = null;
    if (id) {
      const result = await supabaseAdmin.from("coupons").select("*").eq("id", id).single();
      if (result.error) throw new Error(result.error.message);
      before = result.data;
    }
    const payload = { ...data, id: undefined, code: data.code.toUpperCase(), created_by: id ? undefined : actor.userId, updated_at: new Date().toISOString() };
    const result = id
      ? await supabaseAdmin.from("coupons").update(payload as any).eq("id", id).select("id").single()
      : await supabaseAdmin.from("coupons").insert(payload as any).select("id").single();
    if (result.error) throw new Error(result.error.message);
    await writeAudit({ actorUserId: actor.userId, actorEmail: actor.email, action: id ? "coupon.update" : "coupon.create", entityType: "coupon", entityId: result.data.id, before, after: data });
    return { id: result.data.id };
  });

export const adminArchiveCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "coupons.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const archivedAt = new Date().toISOString();
    const { data: before, error: readError } = await supabaseAdmin.from("coupons").select("code, active").eq("id", data.id).single();
    if (readError) throw new Error(readError.message);
    const { error } = await (supabaseAdmin as any).from("coupons").update({ active: false, archived_at: archivedAt, updated_at: archivedAt }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit({ actorUserId: actor.userId, actorEmail: actor.email, action: "coupon.archive", entityType: "coupon", entityId: data.id, before, after: { active: false, archived_at: archivedAt } });
    return { ok: true };
  });
