import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ------------------------------------------------------------------ public */

const TrackInput = z.object({
  code: z.string().trim().min(2).max(40),
  visitorId: z.string().trim().min(6).max(64),
  landingPath: z.string().trim().max(300).optional(),
  referrer: z.string().trim().max(300).optional(),
});

/** Records a `?ref=CODE` visit. Public by design; no data is returned. */
export const trackReferralVisit = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TrackInput.parse(input))
  .handler(async ({ data }) => {
    const { recordReferral } = await import("./affiliate.server");
    const res = await recordReferral({
      code: data.code,
      visitorId: data.visitorId,
      landingPath: data.landingPath ?? null,
      referrer: data.referrer ?? null,
    });
    return { ok: res.ok };
  });

/** Public program info for the marketing page. */
export const getAffiliateProgramInfo = createServerFn({ method: "GET" }).handler(async () => {
  const { getSettings } = await import("./affiliate.server");
  const s = await getSettings();
  return {
    enabled: s.enabled,
    commissionKind: s.default_commission_kind,
    commissionValue: s.default_commission_value,
    attributionDays: s.attribution_days,
    minPayout: s.min_payout,
    terms: s.terms,
  };
});

const ProductClickInput = z.object({
  code: z.string().trim().min(2).max(40),
  visitorId: z.string().trim().min(6).max(64),
  productId: z.string().uuid().optional(),
  landingPath: z.string().trim().max(300).optional(),
  referrer: z.string().trim().max(300).optional(),
});

/** Records a click that arrived on a product page through an affiliate link. */
export const trackProductReferralClick = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ProductClickInput.parse(input))
  .handler(async ({ data }) => {
    const { recordProductClick } = await import("./affiliate.server");
    await recordProductClick({
      code: data.code,
      visitorId: data.visitorId,
      productId: data.productId ?? null,
      landingPath: data.landingPath ?? null,
      referrer: data.referrer ?? null,
    });
    return { ok: true };
  });

/**
 * The signed-in affiliate's share link and expected earnings for one product.
 * Returns `affiliate: null` for everyone who isn't an approved affiliate, so
 * the PDP simply hides the panel.
 */
export const getProductAffiliateLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ productId: z.string().uuid(), slug: z.string().trim().max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getSettings, resolveProductRule, commissionForLine } = await import("./affiliate.server");
    const settings = await getSettings();
    if (!settings.enabled) return { affiliate: null as null };

    const { findAffiliateForUser } = await import("./affiliate.server");
    const aff = await findAffiliateForUser(context.userId, context.claims.email as string | undefined);
    if (!aff || aff.status !== "approved") return { affiliate: null as null };

    const { data: product } = await supabaseAdmin
      .from("products")
      .select(
        "id, price, affiliate_enabled, affiliate_commission_kind, affiliate_commission_value, affiliate_max_commission, affiliate_starts_at, affiliate_ends_at",
      )
      .eq("id", data.productId)
      .maybeSingle();

    const rule = resolveProductRule(product, aff, settings);
    const { amount } = commissionForLine(rule, Number(product?.price ?? 0), 1);

    const [clicks, conversions] = await Promise.all([
      supabaseAdmin
        .from("affiliate_product_clicks")
        .select("id", { count: "exact", head: true })
        .eq("affiliate_id", aff.id)
        .eq("product_id", data.productId),
      supabaseAdmin
        .from("affiliate_commission_items")
        .select("amount")
        .eq("affiliate_id", aff.id)
        .eq("product_id", data.productId),
    ]);

    return {
      affiliate: {
        code: aff.code,
        slug: data.slug,
        // Approved affiliates always get their shareable link; commission
        // details only show when this product actually earns.
        enabled: true,
        commissionEnabled: rule.enabled && amount > 0,
        commissionKind: rule.kind,
        commissionValue: rule.value,
        perUnitEarning: amount,
        clicks: clicks.count ?? 0,
        earned:
          Math.round(
            ((conversions.data ?? []).reduce((s, r) => s + Number(r.amount), 0)) * 100,
          ) / 100,
      },
    };
  });


/* ------------------------------------------------------- affiliate (owner) */

export const claimReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ visitorId: z.string().trim().min(6).max(64) }).parse(input))
  .handler(async ({ data, context }) => {
    const { claimReferralForUser } = await import("./affiliate.server");
    return claimReferralForUser(data.visitorId, context.userId);
  });

const ApplySchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  mobile: z.string().trim().min(8).max(20).regex(/^[+\d\s\-()]+$/),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  address: z.string().trim().max(400).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  state: z.string().trim().max(120).optional().or(z.literal("")),
  pincode: z.string().trim().max(12).optional().or(z.literal("")),
  pan: z.string().trim().max(20).optional().or(z.literal("")),
  gstin: z.string().trim().max(20).optional().or(z.literal("")),
  payout_method: z.enum(["upi", "bank"]),
  payout_upi: z.string().trim().max(120).optional().or(z.literal("")),
  payout_account_name: z.string().trim().max(160).optional().or(z.literal("")),
  payout_account_number: z.string().trim().max(40).optional().or(z.literal("")),
  payout_ifsc: z.string().trim().max(20).optional().or(z.literal("")),
  payout_bank: z.string().trim().max(160).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const applyAsAffiliate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ApplySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { getSettings, generateCode, logAffiliate } = await import("./affiliate.server");
    const settings = await getSettings();
    if (!settings.enabled) throw new Error("The affiliate program is currently closed.");
    if (data.payout_method === "upi" && !data.payout_upi) throw new Error("Please provide your UPI ID.");
    if (data.payout_method === "bank" && (!data.payout_account_number || !data.payout_ifsc)) {
      throw new Error("Please provide your bank account number and IFSC.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { findAffiliateForUser } = await import("./affiliate.server");
    const existing = await findAffiliateForUser(context.userId, context.claims.email as string | undefined);
    if (existing) throw new Error("You have already applied to the affiliate program.");

    const code = await generateCode(data.full_name);
    const { data: row, error } = await supabaseAdmin
      .from("affiliates")
      .insert({
        ...data,
        company: data.company || null,
        website: data.website || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        pincode: data.pincode || null,
        pan: data.pan || null,
        gstin: data.gstin || null,
        payout_upi: data.payout_upi || null,
        payout_account_name: data.payout_account_name || null,
        payout_account_number: data.payout_account_number || null,
        payout_ifsc: data.payout_ifsc || null,
        payout_bank: data.payout_bank || null,
        notes: data.notes || null,
        user_id: context.userId,
        code,
        status: settings.auto_approve_affiliates ? "approved" : "pending",
        approved_at: settings.auto_approve_affiliates ? new Date().toISOString() : null,
      })
      .select("id, code, status")
      .single();
    if (error || !row) throw new Error("Could not submit your application. Please try again.");
    await logAffiliate({ affiliateId: row.id, actorUserId: context.userId, action: "affiliate.applied" });
    return { id: row.id, code: row.code, status: row.status };
  });

export const getMyAffiliate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getBalance, getSettings, payoutComplete } = await import("./affiliate.server");
    const settings = await getSettings();

    const { findAffiliateForUser } = await import("./affiliate.server");
    const aff = await findAffiliateForUser(context.userId, context.claims.email as string | undefined);
    if (!aff) return { affiliate: null, settings };

    const [balance, commissions, referrals, withdrawals] = await Promise.all([
      getBalance(aff.id),
      supabaseAdmin
        .from("affiliate_commissions")
        .select("id, order_number, order_total, amount, status, created_at")
        .eq("affiliate_id", aff.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("affiliate_referrals")
        .select("id, landing_path, first_seen_at, converted_at, expires_at")
        .eq("affiliate_id", aff.id)
        .order("first_seen_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("affiliate_withdrawals")
        .select("id, amount, method, status, reference, admin_note, created_at, processed_at")
        .eq("affiliate_id", aff.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    return {
      settings,
      affiliate: {
        id: aff.id,
        code: aff.code,
        status: aff.status,
        full_name: aff.full_name,
        email: aff.email,
        mobile: aff.mobile,
        company: aff.company,
        address: aff.address,
        city: aff.city,
        state: aff.state,
        pincode: aff.pincode,
        pan: aff.pan,
        gstin: aff.gstin,
        payout_method: aff.payout_method,
        payout_upi: aff.payout_upi,
        payout_account_name: aff.payout_account_name,
        payout_account_number: aff.payout_account_number,
        payout_ifsc: aff.payout_ifsc,
        payout_bank: aff.payout_bank,
        commission_kind: aff.commission_kind ?? settings.default_commission_kind,
        commission_value: Number(aff.commission_value ?? settings.default_commission_value),
        created_at: aff.created_at,
      },
      payoutReady: payoutComplete(aff),
      balance,
      commissions: commissions.data ?? [],
      referrals: referrals.data ?? [],
      withdrawals: withdrawals.data ?? [],
    };
  });

/** Affiliate updates their own KYC / payment details used for payouts. */
export const updateMyPayoutDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        full_name: z.string().trim().min(2).max(120),
        mobile: z.string().trim().min(8).max(20),
        company: z.string().trim().max(160).optional().or(z.literal("")),
        address: z.string().trim().max(400).optional().or(z.literal("")),
        city: z.string().trim().max(120).optional().or(z.literal("")),
        state: z.string().trim().max(120).optional().or(z.literal("")),
        pincode: z.string().trim().max(12).optional().or(z.literal("")),
        pan: z.string().trim().max(20).optional().or(z.literal("")),
        gstin: z.string().trim().max(20).optional().or(z.literal("")),
        payout_method: z.enum(["upi", "bank"]),
        payout_upi: z.string().trim().max(120).optional().or(z.literal("")),
        payout_account_name: z.string().trim().max(160).optional().or(z.literal("")),
        payout_account_number: z.string().trim().max(40).optional().or(z.literal("")),
        payout_ifsc: z.string().trim().max(20).optional().or(z.literal("")),
        payout_bank: z.string().trim().max(160).optional().or(z.literal("")),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { payoutComplete } = await import("./affiliate.server");
    const check = payoutComplete({ ...data, email: "ok" });
    if (!check.ok) throw new Error(`Please complete: ${check.missing.join(", ")}`);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAffiliate } = await import("./affiliate.server");
    const { findAffiliateForUser } = await import("./affiliate.server");
    const aff = await findAffiliateForUser(context.userId, context.claims.email as string | undefined);
    if (!aff) throw new Error("You are not an affiliate.");
    const nullable = (v?: string) => (v && v.trim() ? v.trim() : null);
    const { error } = await supabaseAdmin
      .from("affiliates")
      .update({
        full_name: data.full_name,
        mobile: data.mobile,
        company: nullable(data.company),
        address: nullable(data.address),
        city: nullable(data.city),
        state: nullable(data.state),
        pincode: nullable(data.pincode),
        pan: nullable(data.pan)?.toUpperCase() ?? null,
        gstin: nullable(data.gstin)?.toUpperCase() ?? null,
        payout_method: data.payout_method,
        payout_upi: nullable(data.payout_upi),
        payout_account_name: nullable(data.payout_account_name),
        payout_account_number: nullable(data.payout_account_number),
        payout_ifsc: nullable(data.payout_ifsc)?.toUpperCase() ?? null,
        payout_bank: nullable(data.payout_bank),
      })
      .eq("id", aff.id);
    if (error) throw new Error("Could not save your payment details.");
    await logAffiliate({
      affiliateId: aff.id,
      actorUserId: context.userId,
      action: "affiliate.payout_details_updated",
    });
    return { ok: true as const };
  });


export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ amount: z.number().positive().max(10_000_000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getBalance, getSettings, logAffiliate, payoutComplete } = await import("./affiliate.server");
    const settings = await getSettings();

    const { findAffiliateForUser } = await import("./affiliate.server");
    const aff = await findAffiliateForUser(context.userId, context.claims.email as string | undefined);
    if (!aff) throw new Error("You are not an affiliate.");
    if (aff.status !== "approved") throw new Error("Your affiliate account is not approved yet.");
    const ready = payoutComplete(aff);
    if (!ready.ok) {
      throw new Error(`Complete your payment details first: ${ready.missing.join(", ")}`);
    }


    const balance = await getBalance(aff.id);
    const amount = Math.round(data.amount * 100) / 100;
    if (amount < settings.min_payout) throw new Error(`Minimum payout is ₹${settings.min_payout}.`);
    if (amount > balance.available) throw new Error(`You can withdraw up to ₹${balance.available.toFixed(2)}.`);

    const { error } = await supabaseAdmin.from("affiliate_withdrawals").insert({
      affiliate_id: aff.id,
      amount,
      method: aff.payout_method,
      payout_snapshot: {
        method: aff.payout_method,
        upi: aff.payout_upi,
        account_name: aff.payout_account_name,
        account_number: aff.payout_account_number,
        ifsc: aff.payout_ifsc,
        bank: aff.payout_bank,
      } as never,
    });
    if (error) throw new Error("Could not submit your withdrawal request.");
    await logAffiliate({
      affiliateId: aff.id,
      actorUserId: context.userId,
      action: "withdrawal.requested",
      detail: { amount },
    });
    return { ok: true as const };
  });

/* ------------------------------------------------------------------- admin */

async function assertAdminCtx(context: { supabase: unknown; userId: string; claims: unknown }) {
  const { assertAdmin } = await import("./admin.server");
  return assertAdmin(context as never);
}

export const adminAffiliateOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminCtx(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getSettings, payoutComplete } = await import("./affiliate.server");

    const [settings, affiliates, commissions, withdrawals, referrals, logs] = await Promise.all([
      getSettings(),
      supabaseAdmin.from("affiliates").select("*").order("created_at", { ascending: false }).limit(500),
      supabaseAdmin
        .from("affiliate_commissions")
        .select("*, affiliates(code, full_name)")
        .order("created_at", { ascending: false })
        .limit(500),
      supabaseAdmin
        .from("affiliate_withdrawals")
        .select("*, affiliates(code, full_name, email)")
        .order("created_at", { ascending: false })
        .limit(300),
      supabaseAdmin
        .from("affiliate_referrals")
        .select("*, affiliates(code, full_name)")
        .order("first_seen_at", { ascending: false })
        .limit(500),
      supabaseAdmin
        .from("affiliate_logs")
        .select("*, affiliates(code)")
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

    const rows = affiliates.data ?? [];
    const comms = commissions.data ?? [];
    const refs = referrals.data ?? [];
    const paysOut = withdrawals.data ?? [];
    const stats = rows.map((a) => {
      const mine = comms.filter((c) => c.affiliate_id === a.id);
      const sum = (s: string) =>
        Math.round(mine.filter((c) => c.status === s).reduce((t, c) => t + Number(c.amount), 0) * 100) / 100;
      const withdrawnPending =
        Math.round(
          paysOut
            .filter(
              (w) =>
                w.affiliate_id === a.id &&
                ["requested", "approved", "processing"].includes(w.status as string),
            )
            .reduce((t, w) => t + Number(w.amount), 0) * 100,
        ) / 100;
      const approved = sum("approved");
      return {
        affiliate_id: a.id,
        referrals: refs.filter((r) => r.affiliate_id === a.id).length,
        orders: mine.length,
        pending: sum("pending"),
        approved,
        paid: sum("paid"),
        reversed: sum("reversed"),
        withdrawnPending,
        available: Math.round(Math.max(0, approved - withdrawnPending) * 100) / 100,
        payout: payoutComplete(a),
      };
    });

    // Product-level performance: clicks on product links vs commission earned.
    const [clickRows, itemRows] = await Promise.all([
      supabaseAdmin
        .from("affiliate_product_clicks")
        .select("product_id, affiliate_id, created_at")
        .order("created_at", { ascending: false })
        .limit(5000),
      supabaseAdmin
        .from("affiliate_commission_items")
        .select("product_id, product_name, quantity, amount")
        .limit(5000),
    ]);

    const byProduct = new Map<
      string,
      { product_id: string; product_name: string; clicks: number; units: number; commission: number }
    >();
    for (const it of itemRows.data ?? []) {
      const key = it.product_id ?? it.product_name;
      const row =
        byProduct.get(key) ??
        { product_id: it.product_id ?? "", product_name: it.product_name, clicks: 0, units: 0, commission: 0 };
      row.units += Number(it.quantity);
      row.commission = Math.round((row.commission + Number(it.amount)) * 100) / 100;
      byProduct.set(key, row);
    }
    for (const c of clickRows.data ?? []) {
      if (!c.product_id) continue;
      const row =
        byProduct.get(c.product_id) ??
        { product_id: c.product_id, product_name: "—", clicks: 0, units: 0, commission: 0 };
      row.clicks += 1;
      byProduct.set(c.product_id, row);
    }
    const missingNames = [...byProduct.values()].filter((r) => r.product_name === "—" && r.product_id);
    if (missingNames.length > 0) {
      const { data: named } = await supabaseAdmin
        .from("products")
        .select("id, name")
        .in("id", missingNames.map((r) => r.product_id));
      for (const p of named ?? []) {
        const row = byProduct.get(p.id);
        if (row) row.product_name = p.name;
      }
    }
    const productStats = [...byProduct.values()].sort((a, b) => b.commission - a.commission).slice(0, 50);

    // 30-day daily trend (IST-agnostic ISO day buckets) for the analytics tab.
    const DAYS = 30;
    const dayKey = (d: string | Date) => new Date(d).toISOString().slice(0, 10);
    const series: Array<{
      day: string;
      clicks: number;
      visitors: number;
      signups: number;
      orders: number;
      commission: number;
    }> = [];
    const index = new Map<string, number>();
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      const key = dayKey(d);
      index.set(key, series.length);
      series.push({ day: key, clicks: 0, visitors: 0, signups: 0, orders: 0, commission: 0 });
    }
    const bump = (key: string, fn: (row: (typeof series)[number]) => void) => {
      const i = index.get(key);
      if (i != null) fn(series[i]!);
    };
    for (const c of clickRows.data ?? []) bump(dayKey(c.created_at), (r) => void r.clicks++);
    for (const r0 of refs) {
      bump(dayKey(r0.first_seen_at), (r) => {
        r.visitors++;
        if (r0.user_id) r.signups++;
      });
    }
    for (const c of comms) {
      bump(dayKey(c.created_at), (r) => {
        r.orders++;
        r.commission = Math.round((r.commission + Number(c.amount)) * 100) / 100;
      });
    }

    const totalClicks = (clickRows.data ?? []).length;
    const analytics = {
      series,
      totals: {
        clicks: totalClicks,
        visitors: refs.length,
        signups: refs.filter((r) => r.user_id).length,
        conversions: refs.filter((r) => r.converted_at).length,
        orders: comms.length,
        commission:
          Math.round(comms.reduce((t, c) => t + Number(c.amount), 0) * 100) / 100,
        aov:
          comms.length > 0
            ? Math.round((comms.reduce((t, c) => t + Number(c.order_total), 0) / comms.length) * 100) / 100
            : 0,
        clickToOrder: totalClicks > 0 ? Math.round((comms.length / totalClicks) * 1000) / 10 : 0,
        payableNow:
          Math.round(stats.reduce((t, s) => t + s.available, 0) * 100) / 100,
        awaitingPayout:
          Math.round(
            paysOut
              .filter((w) => ["requested", "approved", "processing"].includes(w.status as string))
              .reduce((t, w) => t + Number(w.amount), 0) * 100,
          ) / 100,
        incompleteDetails: stats.filter((s) => !s.payout.ok).length,
      },
      leaderboard: rows
        .map((a) => {
          const s = stats.find((x) => x.affiliate_id === a.id)!;
          return {
            id: a.id,
            code: a.code,
            name: a.full_name,
            clicks: (clickRows.data ?? []).filter((c) => c.affiliate_id === a.id).length,
            referrals: s.referrals,
            orders: s.orders,
            earned: Math.round((s.pending + s.approved + s.paid) * 100) / 100,
            available: s.available,
          };
        })
        .sort((a, b) => b.earned - a.earned)
        .slice(0, 20),
    };

    return {
      settings,
      affiliates: rows,
      stats,
      productStats,
      analytics,
      commissions: comms,
      withdrawals: paysOut,
      referrals: refs,
      logs: logs.data ?? [],
    };

  });

export const adminSaveAffiliateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        enabled: z.boolean(),
        default_commission_kind: z.enum(["percentage", "fixed"]),
        default_commission_value: z.number().min(0).max(100000),
        attribution_days: z.number().int().min(1).max(365),
        cookie_days: z.number().int().min(1).max(365),
        min_payout: z.number().min(0).max(1_000_000),
        auto_approve_affiliates: z.boolean(),
        auto_approve_commission_on_delivery: z.boolean(),
        exclude_shipping: z.boolean(),
        terms: z.string().trim().max(5000).optional().or(z.literal("")),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const actor = await assertAdminCtx(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAffiliate } = await import("./affiliate.server");
    const { error } = await supabaseAdmin
      .from("affiliate_settings")
      .update({ ...data, terms: data.terms || null })
      .eq("id", true);
    if (error) throw new Error("Could not save affiliate settings.");
    await logAffiliate({ affiliateId: null, actorUserId: actor.userId, action: "settings.updated", detail: data });
    return { ok: true as const };
  });

export const adminCreateAffiliate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    ApplySchema.extend({
      status: z.enum(["pending", "approved", "suspended", "rejected"]).default("approved"),
      commission_kind: z.enum(["percentage", "fixed"]).optional(),
      commission_value: z.number().min(0).max(100000).optional(),
      code: z.string().trim().min(3).max(40).optional().or(z.literal("")),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const actor = await assertAdminCtx(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateCode, logAffiliate } = await import("./affiliate.server");

    const code = data.code?.trim() ? data.code.trim().toUpperCase() : await generateCode(data.full_name);
    const { data: clash } = await supabaseAdmin.from("affiliates").select("id").ilike("code", code).maybeSingle();
    if (clash) throw new Error("That referral code is already taken.");

    const { status, commission_kind, commission_value, code: _ignored, ...rest } = data;
    const { data: row, error } = await supabaseAdmin
      .from("affiliates")
      .insert({
        ...rest,
        company: rest.company || null,
        website: rest.website || null,
        address: rest.address || null,
        city: rest.city || null,
        state: rest.state || null,
        pincode: rest.pincode || null,
        pan: rest.pan || null,
        gstin: rest.gstin || null,
        payout_upi: rest.payout_upi || null,
        payout_account_name: rest.payout_account_name || null,
        payout_account_number: rest.payout_account_number || null,
        payout_ifsc: rest.payout_ifsc || null,
        payout_bank: rest.payout_bank || null,
        notes: rest.notes || null,
        code,
        status,
        commission_kind: commission_kind ?? null,
        commission_value: commission_value ?? null,
        approved_at: status === "approved" ? new Date().toISOString() : null,
        approved_by: status === "approved" ? actor.userId : null,
      })
      .select("id, code")
      .single();
    if (error || !row) throw new Error("Could not create the affiliate.");
    await logAffiliate({ affiliateId: row.id, actorUserId: actor.userId, action: "affiliate.created_by_admin" });
    return { id: row.id, code: row.code };
  });

export const adminUpdateAffiliate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "approved", "suspended", "rejected"]).optional(),
        commission_kind: z.enum(["percentage", "fixed"]).nullable().optional(),
        commission_value: z.number().min(0).max(100000).nullable().optional(),
        admin_notes: z.string().trim().max(2000).optional(),
        mobile: z.string().trim().min(8).max(20).optional(),
        email: z.string().trim().email().max(200).optional(),
        payout_upi: z.string().trim().max(120).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const actor = await assertAdminCtx(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAffiliate } = await import("./affiliate.server");
    const { id, ...patch } = data;
    const update: Record<string, unknown> = { ...patch };
    if (patch.status === "approved") {
      update["approved_at"] = new Date().toISOString();
      update["approved_by"] = actor.userId;
    }
    const { error } = await supabaseAdmin.from("affiliates").update(update as never).eq("id", id);
    if (error) throw new Error("Could not update the affiliate.");
    await logAffiliate({ affiliateId: id, actorUserId: actor.userId, action: "affiliate.updated", detail: patch });
    return { ok: true as const };
  });

export const adminSetCommissionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(200),
        status: z.enum(["pending", "approved", "paid", "reversed", "cancelled"]),
        reason: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const actor = await assertAdminCtx(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAffiliate } = await import("./affiliate.server");
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("affiliate_commissions")
      .update({
        status: data.status,
        reason: data.reason ?? null,
        approved_at: data.status === "approved" ? now : null,
        paid_at: data.status === "paid" ? now : null,
      })
      .in("id", data.ids);
    if (error) throw new Error("Could not update commissions.");
    await logAffiliate({
      affiliateId: null,
      actorUserId: actor.userId,
      action: "commission.status_changed",
      detail: { ids: data.ids, status: data.status },
    });
    return { ok: true as const, count: data.ids.length };
  });

export const adminSetWithdrawalStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["requested", "approved", "processing", "paid", "rejected"]),
        reference: z.string().trim().max(120).optional(),
        admin_note: z.string().trim().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const actor = await assertAdminCtx(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAffiliate } = await import("./affiliate.server");

    const { data: wd } = await supabaseAdmin
      .from("affiliate_withdrawals")
      .select("id, affiliate_id, amount, status")
      .eq("id", data.id)
      .maybeSingle();
    if (!wd) throw new Error("Withdrawal request not found.");

    const { error } = await supabaseAdmin
      .from("affiliate_withdrawals")
      .update({
        status: data.status,
        reference: data.reference ?? null,
        admin_note: data.admin_note ?? null,
        processed_by: actor.userId,
        processed_at: data.status === "paid" || data.status === "rejected" ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error("Could not update the withdrawal request.");

    // Marking a payout as paid settles approved commissions up to the amount.
    if (data.status === "paid" && wd.status !== "paid") {
      const { data: approved } = await supabaseAdmin
        .from("affiliate_commissions")
        .select("id, amount")
        .eq("affiliate_id", wd.affiliate_id)
        .eq("status", "approved")
        .order("created_at", { ascending: true });
      let remaining = Number(wd.amount);
      const settle: string[] = [];
      for (const c of approved ?? []) {
        if (remaining <= 0) break;
        settle.push(c.id);
        remaining -= Number(c.amount);
      }
      if (settle.length > 0) {
        await supabaseAdmin
          .from("affiliate_commissions")
          .update({ status: "paid", paid_at: new Date().toISOString(), withdrawal_id: data.id })
          .in("id", settle);
      }
    }

    await logAffiliate({
      affiliateId: wd.affiliate_id,
      actorUserId: actor.userId,
      action: "withdrawal.status_changed",
      detail: { id: data.id, status: data.status },
    });
    return { ok: true as const };
  });
