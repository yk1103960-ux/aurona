/**
 * Client-side checkout hand-off state.
 *
 * The shopping flow is split across dedicated pages (cart → address →
 * checkout → payment), so the few selections the customer makes along the way
 * are kept in sessionStorage. Nothing here is trusted by the server: prices,
 * delivery charges, discounts and the final amount are always recomputed
 * server-side when the order is placed.
 */
export type CheckoutFlow = {
  addressId?: string | null;
  rateId?: string | null;
  coupon?: string | null;
  method?: "cod" | "upi" | "card";
};

const KEY = "aurona_checkout_flow";

export function readFlow(): CheckoutFlow {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CheckoutFlow) : {};
  } catch {
    return {};
  }
}

export function writeFlow(patch: CheckoutFlow): CheckoutFlow {
  const next = { ...readFlow(), ...patch };
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode — the flow simply restarts */
    }
  }
  return next;
}

export function clearFlow() {
  if (typeof window !== "undefined") sessionStorage.removeItem(KEY);
}
