import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useCart } from "./useCart";
import { readFlow, writeFlow, type CheckoutFlow } from "@/lib/checkout-flow";
import { quoteShipping } from "@/lib/shipping.functions";
import { applyCoupon } from "@/lib/coupons.functions";
import type { AddressRow } from "@/components/account/AddressManager";

export type DeliveryOption = {
  id: string;
  label: string;
  eta: string;
  price: number;
};

/**
 * Single source of truth for the money shown across cart → checkout → payment.
 *
 * Delivery is quoted on the server.
 * Coupon validation goes through applyCoupon().
 * This file does NOT call the broken validate_coupon RPC.
 *
 * Final order totals are recomputed again server-side when the order is placed.
 */
export function useCheckoutSummary() {
  const { user, loading: authLoading } = useAuth();
  const cart = useCart();

  const [flow, setFlow] = useState<CheckoutFlow>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setFlow(readFlow());
    setHydrated(true);
  }, []);

  const patchFlow = (patch: CheckoutFlow) => {
    setFlow(writeFlow(patch));
  };

  const addressesQuery = useQuery({
    queryKey: ["addresses", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addresses")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []) as AddressRow[];
    },
  });

  const addresses = addressesQuery.data ?? [];

  const address = addresses.find((a) => a.id === flow.addressId) ?? null;

  const method = flow.method ?? "cod";
  const cod = method === "cod";

  const quoteFn = useServerFn(quoteShipping);

  const deliveryQuery = useQuery({
    queryKey: ["delivery-quote", address?.pincode ?? null, cod, cart.count, cart.subtotal],
    enabled: Boolean(address?.pincode) && cart.items.length > 0,
    queryFn: () =>
      quoteFn({
        data: {
          pincode: address!.pincode,
          cod,
        },
      }),
    retry: false,
  });

  const rates: DeliveryOption[] = deliveryQuery.data?.rates ?? [];

  const serviceable = deliveryQuery.data?.serviceable ?? false;

  const rate = rates.find((r) => r.id === flow.rateId) ?? rates[0] ?? null;

  useEffect(() => {
    if (rate && flow.rateId !== rate.id) {
      patchFlow({
        rateId: rate.id,
      });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rate?.id]);

  /**
   * Coupon validation
   *
   * IMPORTANT:
   * Do NOT use:
   *
   * supabase.rpc("validate_coupon")
   *
   * That SQL function currently has the ambiguous coupon_id bug.
   */
  const applyCouponFn = useServerFn(applyCoupon);

  const couponQuery = useQuery({
    queryKey: ["coupon", flow.coupon ?? null, cart.subtotal, user?.id ?? null],

    enabled: Boolean(flow.coupon) && cart.subtotal > 0,

    queryFn: async () => {
      try {
        return await applyCouponFn({
          data: {
            code: flow.coupon!,
            subtotal: cart.subtotal,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not validate coupon";

        return {
          valid: false,
          couponId: null,
          discount: 0,
          reason: message,
        };
      }
    },

    retry: false,
  });

  const couponValid = Boolean(couponQuery.data?.valid);

  const discount = couponValid ? Number(couponQuery.data?.discount ?? 0) : 0;

  const delivery = rate?.price ?? 0;

  const mrpSavings = Math.max(0, cart.mrpTotal - cart.subtotal);

  const total = Math.max(0, cart.subtotal - discount + delivery);

  return {
    user,
    authLoading,

    cart,

    flow,
    patchFlow,
    hydrated,

    addresses,
    addressesLoading: addressesQuery.isLoading,

    address,

    method,

    rates,
    rate,
    serviceable,

    deliveryLoading: deliveryQuery.isFetching,

    deliveryMessage: deliveryQuery.data?.message ?? null,

    deliveryFailed: deliveryQuery.isError,

    couponCode: flow.coupon ?? null,

    couponValid,

    couponChecking: couponQuery.isFetching,

    couponReason: couponQuery.data?.reason ?? null,

    discount,

    delivery,

    mrpSavings,

    subtotal: cart.subtotal,

    total,
  };
}
