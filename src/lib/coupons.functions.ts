import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ApplyCouponSchema = z.object({
  code: z.string().trim().min(2).max(64),
  subtotal: z.number().positive(),
});

export const applyCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ApplyCouponSchema.parse(input))
  .handler(async ({ data, context }) => {
    const code = data.code.trim().toUpperCase();

    const { data: rows, error } = await context.supabase.rpc("validate_coupon", {
      _code: code,
      _subtotal: data.subtotal,
    });

    if (error) {
      console.error("validate_coupon failed:", error);

      // This specific error is raised by the SQL function when an unqualified
      // coupon_id exists in more than one scope/table.
      if (error.message?.toLowerCase().includes("coupon_id") && error.message?.toLowerCase().includes("ambiguous")) {
        throw new Error('Coupon validation database function is misconfigured: "coupon_id" is ambiguous.');
      }

      throw new Error(error.message || "Could not validate coupon");
    }

    const row = Array.isArray(rows) ? rows[0] : rows;

    if (!row) {
      return {
        valid: false,
        couponId: null,
        discount: 0,
        reason: "Invalid or unavailable coupon",
      };
    }

    const discount = Math.max(0, Number(row.discount ?? 0));

    return {
      valid: Boolean(row.coupon_id),
      couponId: row.coupon_id ?? null,
      discount,
      reason: row.reason ?? null,
    };
  });
