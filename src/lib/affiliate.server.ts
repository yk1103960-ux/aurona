// Server-only affiliate engine: attribution, commission ledger, payouts.
// All writes go through the service-role client after the caller is verified
// by the calling server function.

export type AffiliateSettings = {
  enabled: boolean;
  default_commission_kind: "percentage" | "fixed";
  default_commission_value: number;
  attribution_days: number;
  cookie_days: number;
  min_payout: number;
  auto_approve_affiliates: boolean;
  auto_approve_commission_on_delivery: boolean;
  exclude_shipping: boolean;
  terms: string | null;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function getSettings(): Promise<AffiliateSettings> {
  const db = await admin();
  const { data } = await db.from("affiliate_settings").select("*").eq("id", true).maybeSingle();
  return {
    enabled: data?.enabled ?? true,
    default_commission_kind: (data?.default_commission_kind ?? "percentage") as "percentage" | "fixed",
    default_commission_value: Number(data?.default_commission_value ?? 5),
    attribution_days: Number(data?.attribution_days ?? 30),
    cookie_days: Number(data?.cookie_days ?? 30),
    min_payout: Number(data?.min_payout ?? 500),
    auto_approve_affiliates: data?.auto_approve_affiliates ?? false,
    auto_approve_commission_on_delivery: data?.auto_approve_commission_on_delivery ?? true,
    exclude_shipping: data?.exclude_shipping ?? true,
    terms: data?.terms ?? null,
  };
}

export async function logAffiliate(params: {
  affiliateId: string | null;
  actorUserId?: string | null;
  action: string;
  detail?: Record<string, unknown>;
}) {
  const db = await admin();
  await db.from("affiliate_logs").insert({
    affiliate_id: params.affiliateId,
    actor_user_id: params.actorUserId ?? null,
    action: params.action,
    detail: (params.detail ?? {}) as never,
  });
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Unique, human-friendly referral code derived from the affiliate's name. */
export async function generateCode(name: string): Promise<string> {
  const db = await admin();
  const base =
    name
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 6) || "AURONA";
  for (let attempt = 0; attempt < 12; attempt++) {
    let suffix = "";
    for (let i = 0; i < 4; i++) {
      suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    const code = `${base}${suffix}`;
    const { data } = await db.from("affiliates").select("id").ilike("code", code).maybeSingle();
    if (!data) return code;
  }
  return `AUR${Date.now().toString(36).toUpperCase()}`;
}

/** Records/refreshes first-touch attribution for a visitor and/or user. */
export async function recordReferral(params: {
  code: string;
  visitorId: string;
  userId?: string | null;
  landingPath?: string | null;
  referrer?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const settings = await getSettings();
  if (!settings.enabled) return { ok: false as const, reason: "Affiliate program is disabled" };

  const db = await admin();
  const { data: aff } = await db
    .from("affiliates")
    .select("id, status, code")
    .ilike("code", params.code.trim())
    .maybeSingle();
  if (!aff || aff.status !== "approved") return { ok: false as const, reason: "Unknown referral code" };

  const expires = new Date(Date.now() + settings.attribution_days * 86_400_000).toISOString();

  // Signed-in users get a single durable attribution row (first touch wins).
  if (params.userId) {
    const { data: existing } = await db
      .from("affiliate_referrals")
      .select("id, affiliate_id, expires_at")
      .eq("user_id", params.userId)
      .maybeSingle();
    if (existing) {
      const stale = new Date(existing.expires_at).getTime() < Date.now();
      if (stale) {
        await db
          .from("affiliate_referrals")
          .update({ affiliate_id: aff.id, expires_at: expires, first_seen_at: new Date().toISOString() })
          .eq("id", existing.id);
      }
      return { ok: true as const, affiliateId: existing.affiliate_id, code: aff.code };
    }
    await db.from("affiliate_referrals").insert({
      affiliate_id: aff.id,
      user_id: params.userId,
      visitor_id: params.visitorId,
      landing_path: params.landingPath ?? null,
      referrer: params.referrer ?? null,
      ip: params.ip ?? null,
      user_agent: params.userAgent ?? null,
      expires_at: expires,
    });
    await logAffiliate({ affiliateId: aff.id, action: "referral.user_attributed", detail: { userId: params.userId } });
    return { ok: true as const, affiliateId: aff.id, code: aff.code };
  }

  // Anonymous visitor row, keyed by the visitor id stored in the browser.
  const { data: v } = await db
    .from("affiliate_referrals")
    .select("id")
    .eq("visitor_id", params.visitorId)
    .is("user_id", null)
    .maybeSingle();
  if (v) {
    await db.from("affiliate_referrals").update({ affiliate_id: aff.id, expires_at: expires }).eq("id", v.id);
  } else {
    await db.from("affiliate_referrals").insert({
      affiliate_id: aff.id,
      visitor_id: params.visitorId,
      landing_path: params.landingPath ?? null,
      referrer: params.referrer ?? null,
      ip: params.ip ?? null,
      user_agent: params.userAgent ?? null,
      expires_at: expires,
    });
  }
  return { ok: true as const, affiliateId: aff.id, code: aff.code };
}

/** Moves an anonymous visitor attribution onto a freshly signed-in user. */
export async function claimReferralForUser(visitorId: string, userId: string) {
  const db = await admin();
  const { data: mine } = await db
    .from("affiliate_referrals")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (mine) return { ok: true as const, claimed: false };

  const { data: anon } = await db
    .from("affiliate_referrals")
    .select("id, affiliate_id, expires_at")
    .eq("visitor_id", visitorId)
    .is("user_id", null)
    .order("first_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!anon) return { ok: true as const, claimed: false };
  if (new Date(anon.expires_at).getTime() < Date.now()) return { ok: true as const, claimed: false };

  await db.from("affiliate_referrals").update({ user_id: userId }).eq("id", anon.id);
  await logAffiliate({ affiliateId: anon.affiliate_id, action: "referral.claimed", detail: { userId } });
  return { ok: true as const, claimed: true };
}

/**
 * Logs a product-scoped affiliate click and also lays down the normal
 * attribution row, so a product link both earns and tracks.
 */
export async function recordProductClick(params: {
  code: string;
  visitorId: string;
  productId: string | null;
  landingPath: string | null;
  referrer: string | null;
}) {
  const res = await recordReferral({
    code: params.code,
    visitorId: params.visitorId,
    landingPath: params.landingPath,
    referrer: params.referrer,
  });
  if (!res.ok || !res.affiliateId) return { ok: false as const };
  const db = await admin();
  await db.from("affiliate_product_clicks").insert({
    affiliate_id: res.affiliateId,
    product_id: params.productId,
    visitor_id: params.visitorId,
    landing_path: params.landingPath,
    referrer: params.referrer,
    source: "product_link",
  });
  return { ok: true as const };
}


export type ProductAffiliateRule = {
  enabled: boolean;
  kind: "percentage" | "fixed";
  value: number;
  max: number | null;
};

/**
 * Resolves the commission rule that applies to one product right now.
 * Priority: product override → affiliate-specific rate → program default.
 * `inherit` / missing values fall through; campaign windows are respected.
 */
export function resolveProductRule(
  product: {
    affiliate_enabled?: boolean | null;
    affiliate_commission_kind?: string | null;
    affiliate_commission_value?: number | null;
    affiliate_max_commission?: number | null;
    affiliate_starts_at?: string | null;
    affiliate_ends_at?: string | null;
  } | null,
  affiliate: { commission_kind?: string | null; commission_value?: number | null },
  settings: AffiliateSettings,
  at: Date = new Date(),
): ProductAffiliateRule {
  const fallbackKind = (affiliate.commission_kind ?? settings.default_commission_kind) as
    | "percentage"
    | "fixed";
  const fallbackValue = Number(affiliate.commission_value ?? settings.default_commission_value);

  if (!product) return { enabled: true, kind: fallbackKind, value: fallbackValue, max: null };
  if (product.affiliate_enabled === false) {
    return { enabled: false, kind: fallbackKind, value: 0, max: null };
  }
  if (product.affiliate_starts_at && new Date(product.affiliate_starts_at) > at) {
    return { enabled: false, kind: fallbackKind, value: 0, max: null };
  }
  if (product.affiliate_ends_at && new Date(product.affiliate_ends_at) < at) {
    return { enabled: false, kind: fallbackKind, value: 0, max: null };
  }

  const overrideKind = product.affiliate_commission_kind;
  const hasOverride =
    (overrideKind === "percentage" || overrideKind === "fixed") &&
    product.affiliate_commission_value != null;

  return {
    enabled: true,
    kind: hasOverride ? (overrideKind as "percentage" | "fixed") : fallbackKind,
    value: hasOverride ? Number(product.affiliate_commission_value) : fallbackValue,
    max: product.affiliate_max_commission != null ? Number(product.affiliate_max_commission) : null,
  };
}

/** Commission for a single order line, honouring quantity and any cap. */
export function commissionForLine(rule: ProductAffiliateRule, unitPrice: number, quantity: number) {
  if (!rule.enabled || rule.value <= 0) return { eligible: 0, amount: 0 };
  const eligible = Math.round(unitPrice * quantity * 100) / 100;
  let amount =
    rule.kind === "fixed"
      ? rule.value * quantity
      : Math.round(((eligible * rule.value) / 100) * 100) / 100;
  amount = Math.min(amount, eligible);
  if (rule.max != null && rule.max > 0) amount = Math.min(amount, rule.max);
  return { eligible, amount: Math.round(amount * 100) / 100 };
}

/**
 * Creates the commission ledger row for a new order, computed PER ORDER ITEM
 * from each product's own affiliate configuration. Idempotent: exactly one
 * commission (with its item breakdown) per order.
 */
export async function recordCommissionForOrder(orderId: string) {
  const settings = await getSettings();
  if (!settings.enabled) return { created: false as const };
  const db = await admin();

  const { data: order } = await db
    .from("orders")
    .select("id, user_id, order_number, subtotal, shipping, total, created_at")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { created: false as const };

  const { data: existing } = await db
    .from("affiliate_commissions")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();
  if (existing) return { created: false as const };

  const { data: referral } = await db
    .from("affiliate_referrals")
    .select("id, affiliate_id, expires_at, converted_at")
    .eq("user_id", order.user_id)
    .maybeSingle();
  if (!referral) return { created: false as const };
  if (new Date(referral.expires_at).getTime() < new Date(order.created_at).getTime()) {
    return { created: false as const };
  }

  const { data: aff } = await db
    .from("affiliates")
    .select("id, user_id, status, commission_kind, commission_value")
    .eq("id", referral.affiliate_id)
    .maybeSingle();
  if (!aff || aff.status !== "approved") return { created: false as const };
  // Affiliates never earn on their own purchases.
  if (aff.user_id && aff.user_id === order.user_id) return { created: false as const };

  const { data: items } = await db
    .from("order_items")
    .select("product_id, product_name, price, quantity")
    .eq("order_id", order.id);
  const lines = items ?? [];

  const productIds = Array.from(
    new Set(lines.map((l) => l.product_id).filter(Boolean) as string[]),
  );
  const products = new Map<string, Record<string, unknown>>();
  if (productIds.length > 0) {
    const { data: prods } = await db
      .from("products")
      .select(
        "id, affiliate_enabled, affiliate_commission_kind, affiliate_commission_value, affiliate_max_commission, affiliate_starts_at, affiliate_ends_at",
      )
      .in("id", productIds);
    for (const p of prods ?? []) products.set(p.id, p as Record<string, unknown>);
  }

  const orderedAt = new Date(order.created_at);
  const breakdown: Array<{
    product_id: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
    eligible_amount: number;
    commission_kind: string;
    commission_value: number;
    amount: number;
  }> = [];
  let total = 0;
  let eligibleTotal = 0;

  for (const line of lines) {
    const product = line.product_id
      ? (products.get(line.product_id) as Parameters<typeof resolveProductRule>[0]) ?? null
      : null;
    const rule = resolveProductRule(product, aff, settings, orderedAt);
    const { eligible, amount } = commissionForLine(rule, Number(line.price), Number(line.quantity));
    if (amount <= 0) continue;
    eligibleTotal += eligible;
    total += amount;
    breakdown.push({
      product_id: line.product_id ?? null,
      product_name: line.product_name,
      quantity: Number(line.quantity),
      unit_price: Number(line.price),
      eligible_amount: eligible,
      commission_kind: rule.kind,
      commission_value: rule.value,
      amount,
    });
  }

  if (breakdown.length === 0 || total <= 0) return { created: false as const };
  total = Math.round(total * 100) / 100;
  eligibleTotal = Math.round(eligibleTotal * 100) / 100;

  const { data: commission, error: cErr } = await db
    .from("affiliate_commissions")
    .insert({
      affiliate_id: aff.id,
      order_id: order.id,
      referral_id: referral.id,
      order_number: order.order_number,
      order_total: Number(order.total),
      eligible_amount: eligibleTotal,
      // Header row stores the blended effective rate; the real per-product
      // rules live in affiliate_commission_items.
      commission_kind: "percentage",
      commission_value:
        eligibleTotal > 0 ? Math.round((total / eligibleTotal) * 10000) / 100 : 0,

      amount: total,
      status: "pending",
    })
    .select("id")
    .single();
  // A unique index on order_id makes concurrent duplicate processing a no-op.
  if (cErr || !commission) return { created: false as const };

  await db.from("affiliate_commission_items").insert(
    breakdown.map((b) => ({
      commission_id: commission.id,
      affiliate_id: aff.id,
      order_id: order.id,
      ...b,
    })),
  );

  if (!referral.converted_at) {
    await db.from("affiliate_referrals").update({ converted_at: new Date().toISOString() }).eq("id", referral.id);
  }
  await logAffiliate({
    affiliateId: aff.id,
    action: "commission.created",
    detail: { orderId: order.id, amount: total, items: breakdown.length },
  });
  return { created: true as const, amount: total };
}


export async function getBalance(affiliateId: string) {
  const db = await admin();
  const { data } = await db.rpc("affiliate_balance", { _affiliate_id: affiliateId });
  const row = (Array.isArray(data) ? data[0] : data) as
    | { pending: number; approved: number; paid: number; reversed: number; withdrawn_pending: number; available: number }
    | undefined;
  return {
    pending: Number(row?.pending ?? 0),
    approved: Number(row?.approved ?? 0),
    paid: Number(row?.paid ?? 0),
    reversed: Number(row?.reversed ?? 0),
    withdrawnPending: Number(row?.withdrawn_pending ?? 0),
    available: Number(row?.available ?? 0),
  };
}

/** Payment details required before an affiliate payout can be requested/paid. */
export function payoutComplete(aff: {
  payout_method?: string | null;
  payout_upi?: string | null;
  payout_account_name?: string | null;
  payout_account_number?: string | null;
  payout_ifsc?: string | null;
  full_name?: string | null;
  mobile?: string | null;
  email?: string | null;
}) {
  const missing: string[] = [];
  if (!aff.full_name?.trim()) missing.push("Full name");
  if (!aff.email?.trim()) missing.push("Email");
  if (!aff.mobile?.trim()) missing.push("Mobile number");
  if (aff.payout_method === "upi") {
    if (!aff.payout_upi?.trim()) missing.push("UPI ID");
  } else {
    if (!aff.payout_account_name?.trim()) missing.push("Account holder name");
    if (!aff.payout_account_number?.trim()) missing.push("Account number");
    if (!aff.payout_ifsc?.trim()) missing.push("IFSC code");
  }
  return { ok: missing.length === 0, missing };
}
