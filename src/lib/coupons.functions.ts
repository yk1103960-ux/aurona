import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ApplyCouponSchema = z.object({
  code: z.string().trim().min(2).max(64),
  subtotal: z.number().positive(),
});

type CouponRow = {
  id: string;
  code: string;
  description: string | null;
  type: "flat" | "percentage";
  value: number;
  min_order_value: number;
  max_discount: number | null;
  starts_at: string | null;
  expires_at: string | null;
  usage_limit: number | null;
  per_user_limit: number;
  eligible_roles: string[] | null;
  times_used: number;
  active: boolean;
};

export const applyCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ApplyCouponSchema.parse(input))
  .handler(async ({ data, context }) => {
    const code = data.code.trim().toUpperCase();
    const subtotal = Number(data.subtotal);

    // IMPORTANT:
    // Do NOT call validate_coupon().
    // The live SQL function currently throws:
    // column reference "coupon_id" is ambiguous.
    //
    // We validate directly from the coupon tables here so checkout works
    // without creating/running another migration.

    const { data: couponData, error: couponError } = await context.supabase
      .from("coupons")
      .select(
        [
          "id",
          "code",
          "description",
          "type",
          "value",
          "min_order_value",
          "max_discount",
          "starts_at",
          "expires_at",
          "usage_limit",
          "per_user_limit",
          "eligible_roles",
          "times_used",
          "active",
        ].join(","),
      )
      .ilike("code", code)
      .eq("active", true)
      .maybeSingle();

    if (couponError) {
      console.error("Coupon lookup failed:", couponError);
      throw new Error(couponError.message || "Could not validate coupon");
    }

    const coupon = couponData as CouponRow | null;

    if (!coupon) {
      return {
        valid: false,
        couponId: null,
        discount: 0,
        reason: "Invalid coupon code",
      };
    }

    const now = Date.now();

    if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) {
      return {
        valid: false,
        couponId: null,
        discount: 0,
        reason: "Coupon not yet active",
      };
    }

    if (coupon.expires_at && new Date(coupon.expires_at).getTime() < now) {
      return {
        valid: false,
        couponId: null,
        discount: 0,
        reason: "Coupon expired",
      };
    }

    if (coupon.usage_limit !== null && Number(coupon.times_used ?? 0) >= Number(coupon.usage_limit)) {
      return {
        valid: false,
        couponId: null,
        discount: 0,
        reason: "Coupon usage limit reached",
      };
    }

    if (subtotal < Number(coupon.min_order_value ?? 0)) {
      return {
        valid: false,
        couponId: null,
        discount: 0,
        reason: "Minimum order not met",
      };
    }

    // Keep the same role rules as the original SQL validate_coupon() function.
    const { data: roleData, error: roleError } = await context.supabase.rpc("current_pricing_role");

    if (roleError) {
      console.error("current_pricing_role failed:", roleError);
      throw new Error(roleError.message || "Could not determine account type");
    }

    const role =
      typeof roleData === "string"
        ? roleData
        : Array.isArray(roleData)
          ? String(roleData[0] ?? "customer")
          : "customer";

    const eligibleRoles = Array.isArray(coupon.eligible_roles)
      ? coupon.eligible_roles
      : ["customer", "retailer", "distributor"];

    if (!eligibleRoles.includes(role)) {
      return {
        valid: false,
        couponId: null,
        discount: 0,
        reason: "Not eligible for this account type",
      };
    }

    // requireSupabaseAuth guarantees an authenticated user.
    const userId = context.userId;

    if (userId) {
      const { count, error: usageError } = await context.supabase
        .from("coupon_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("coupon_id", coupon.id)
        .eq("user_id", userId);

      if (usageError) {
        console.error("Coupon usage lookup failed:", usageError);
        throw new Error(usageError.message || "Could not check coupon usage");
      }

      if (Number(count ?? 0) >= Number(coupon.per_user_limit ?? 1)) {
        return {
          valid: false,
          couponId: null,
          discount: 0,
          reason: "Coupon already used",
        };
      }
    }

    let discount = 0;

    if (coupon.type === "flat") {
      discount = Math.min(Number(coupon.value), subtotal);
    } else {
      discount = (subtotal * Number(coupon.value)) / 100;

      if (coupon.max_discount !== null) {
        discount = Math.min(discount, Number(coupon.max_discount));
      }
    }

    discount = Math.max(0, Math.round(discount * 100) / 100);

    return {
      valid: true,
      couponId: coupon.id,
      discount,
      reason: null,
    };
  });
