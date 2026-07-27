import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const applyCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().trim().min(2).max(64), subtotal: z.number().positive() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("validate_coupon", {
      _code: data.code, _subtotal: data.subtotal,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    return {
      valid: !!row?.coupon_id,
      couponId: row?.coupon_id ?? null,
      discount: Number(row?.discount ?? 0),
      reason: row?.reason ?? null,
    };
  });
