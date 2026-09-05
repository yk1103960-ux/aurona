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
    const supabase = context.supabase;
    const code = data.code.trim().toUpperCase();
    const subtotal = Number(data.subtotal);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        valid: false,
        couponId: null,
        discount: 0,
        reason: "Please sign in to use a coupon.",
      };
    }

    // IMPORTANT:
    // Never call validate_coupon() here.
    // That database RPC currently contains the ambiguous coupon_id reference.

    const { data: coupon, error: couponError } = await supabase
      .from("coupons")
      .select(
        `
        id,
        code,
        type,
        value,
        min_order_value,
        max_discount,
        starts_at,
        expires_at,
        usage_limit,
        per_user_limit,
        eligible_roles,
        times_used,
        active
        `,
      )
      .ilike("code", code)
      .eq("active", true)
      .maybeSingle();

    if (couponError) {
      console.error("Coupon lookup failed:", couponError);

      return {
        valid: false,
        couponId: null,
        discount: 0,
        reason: couponError.message || "Could not validate coupon.",
      };
    }

    if (!coupon) {
      return {
        valid: false,
        couponId: null,
        discount: 0,
        reason: "Invalid coupon code.",
      };
    }

    const now = Date.now();

    if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) {
      return {
        valid: false,
        couponId: null,
        discount: 0,
        reason: "Coupon not yet active.",
      };
    }

    if (coupon.expires_at && new Date(coupon.expires_at).getTime() < now) {
      return {
        valid: false,
        couponId: null,
        discount: 0,
        reason: "Coupon expired.",
      };
    }

    if (coupon.usage_limit !== null && Number(coupon.times_used ?? 0) >= Number(coupon.usage_limit)) {
      return {
        valid: false,
        couponId: null,
        discount: 0,
        reason: "Coupon usage limit reached.",
      };
    }

    if (subtotal < Number(coupon.min_order_value ?? 0)) {
      return {
        valid: false,
        couponId: null,
        discount: 0,
        reason: "Minimum order not met for this coupon.",
      };
    }

    const { data: roleData, error: roleError } = await supabase.rpc("current_pricing_role");

    if (roleError) {
      console.error("Role lookup failed:", roleError);

      return {
        valid: false,
        couponId: null,
        discount: 0,
        reason: "Could not verify account eligibility.",
      };
    }

    const role = (roleData as string | null) ?? "customer";

    const eligibleRoles = Array.isArray(coupon.eligible_roles) ? coupon.eligible_roles : [];

    if (!eligibleRoles.includes(role)) {
      return {
        valid: false,
        couponId: null,
        discount: 0,
        reason: "This coupon is not available for your account type.",
      };
    }

    const { count, error: redemptionError } = await supabase
      .from("coupon_redemptions")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("coupon_id", coupon.id)
      .eq("user_id", user.id);

    if (redemptionError) {
      console.error("Coupon redemption lookup failed:", redemptionError);

      return {
        valid: false,
        couponId: null,
        discount: 0,
        reason: "Could not verify coupon usage.",
      };
    }

    const usedByUser = Number(count ?? 0);
    const perUserLimit = Number(coupon.per_user_limit ?? 1);

    if (usedByUser >= perUserLimit) {
      return {
        valid: false,
        couponId: null,
        discount: 0,
        reason: "Coupon already used.",
      };
    }

    let discount = 0;

    if (coupon.type === "flat") {
      discount = Math.min(Number(coupon.value), subtotal);
    } else {
      discount = subtotal * (Number(coupon.value) / 100);

      if (coupon.max_discount !== null) {
        discount = Math.min(discount, Number(coupon.max_discount));
      }
    }

    discount = Math.max(0, Number(discount.toFixed(2)));

    return {
      valid: true,
      couponId: coupon.id,
      discount,
      reason: null,
    };
  });
