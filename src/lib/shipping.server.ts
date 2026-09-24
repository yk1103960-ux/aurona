// Server-only shipping calculation. All Shiprocket calls happen here; no
// credentials, tokens or raw provider payloads ever reach the browser.

import type { ShippingRate } from "./shipping";

export type CartLine = {
  sku: string | null;
  name: string;
  price: number;
  quantity: number;
};

export type ShippingQuote = {
  serviceable: boolean;
  message: string | null;
  source: "shiprocket" | "fallback";
  weightKg: number;
  rates: ShippingRate[];
};

const DEFAULT_WEIGHT_G = 300;
const FALLBACK_FREE_ABOVE = 999;
const FALLBACK_FLAT = 79;

// Customer-facing delivery naming. Courier/provider names and any logistics
// vendor terminology must never reach the storefront.
const BRAND = "Aurona Delivery";

type Settings = {
  defaultWeightG: number;
  freeAbove: number | null;
  flatRate: number;
  codFee: number;
  pickupPincode: string | null;
};

async function readSettings(): Promise<Settings> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("site_settings")
    .select("key, value")
    .in("key", [
      "shipping_default_weight_g",
      "free_shipping_above",
      "shipping_flat_rate",
      "cod_fee",
      "shipping_pickup_pincode",
    ]);
  const map = new Map((data ?? []).map((r) => [r.key, r.value]));
  const num = (k: string, fallback: number) => {
    const n = Number(map.get(k));
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  const w = Number(map.get("shipping_default_weight_g"));
  const f = map.get("free_shipping_above");
  return {
    defaultWeightG: Number.isFinite(w) && w > 0 ? w : DEFAULT_WEIGHT_G,
    freeAbove: f == null || f === "" ? FALLBACK_FREE_ABOVE : Number(f),
    flatRate: num("shipping_flat_rate", FALLBACK_FLAT),
    codFee: num("cod_fee", 0),
    pickupPincode: map.get("shipping_pickup_pincode")?.trim() || null,
  };
}

/**
 * Build the courier package exclusively from the purchased SKU's packaging
 * measurements. Single-product measurements are intentionally never used for
 * shipping quotes.
 */
export async function computePackage(lines: CartLine[], _defaultWeightG: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const skus = [...new Set(lines.map((line) => line.sku).filter(Boolean) as string[])];
  type PackageDims = { weight_g: number; dim_l: number; dim_w: number; dim_h: number };
  const byKey = new Map<string, PackageDims>();
  const positive = (value: number | null | undefined) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  if (skus.length > 0) {
    const { data: variants, error } = await supabaseAdmin
      .from("product_variants")
      .select("sku, pack_weight_g, pack_l, pack_w, pack_h")
      .in("sku", skus);
    if (error) throw new Error("Could not load package measurements for shipping.");

    for (const variant of variants ?? []) {
      const weight = positive(variant.pack_weight_g);
      const length = positive(variant.pack_l);
      const width = positive(variant.pack_w);
      const height = positive(variant.pack_h);
      if (variant.sku && weight && length && width && height) {
        byKey.set(variant.sku, {
          weight_g: weight,
          dim_l: length,
          dim_w: width,
          dim_h: height,
        });
      }
    }
  }

  let grams = 0;
  let volumeCm3 = 0;
  let footL = 0;
  let footW = 0;
  let tallest = 0;

  for (const line of lines) {
    if (!line.sku) throw new Error(`Package measurements are missing for ${line.name}.`);
    const packageDims = byKey.get(line.sku);
    if (!packageDims) {
      throw new Error(
        `Complete Package Weight, Length, Width and Height for SKU ${line.sku} before calculating shipping.`,
      );
    }

    const qty = Math.max(1, Number(line.quantity) || 1);
    grams += packageDims.weight_g * qty;
    volumeCm3 += packageDims.dim_l * packageDims.dim_w * packageDims.dim_h * qty;
    footL = Math.max(footL, packageDims.dim_l);
    footW = Math.max(footW, packageDims.dim_w);
    tallest = Math.max(tallest, packageDims.dim_h);
  }

  const length = Math.max(1, Math.round(footL));
  const breadth = Math.max(1, Math.round(footW));
  const height = Math.max(1, Math.round(Math.max(tallest, volumeCm3 / (length * breadth))));
  const weightKg = Math.max(0.05, Math.round((grams / 1000) * 100) / 100);
  const volumetricKg = Math.round(((length * breadth * height) / 5000) * 100) / 100;
  return { weightKg, volumetricKg, dims: { length, breadth, height } };
}

/** Pickup pincode for the configured pickup location (cached briefly). */
let pickupCache: { pincode: string; at: number } | null = null;
export async function resolvePickupPincode(configured: string | null): Promise<string | null> {
  if (configured) return configured;
  if (pickupCache && Date.now() - pickupCache.at < 10 * 60 * 1000) return pickupCache.pincode;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveShiprocketToken, shiprocketPickupLocations } = await import("./shiprocket.server");
    const { data: sp } = await supabaseAdmin
      .from("shipping_providers")
      .select("config_public")
      .eq("provider", "shiprocket")
      .maybeSingle();
    const wanted = (sp?.config_public as { pickupLocation?: string } | null)?.pickupLocation ?? "";
    const token = await resolveShiprocketToken();
    const { locations } = await shiprocketPickupLocations(token);
    const match = locations.find((l) => l.pickup_location === wanted) ?? locations[0];
    const pin = match?.pin_code?.toString().trim();
    if (pin) {
      pickupCache = { pincode: pin, at: Date.now() };
      return pin;
    }
  } catch {
    // fall through — caller degrades to flat rates
  }
  return null;
}

const quoteCache = new Map<string, { quote: ShippingQuote; at: number }>();

function fallbackQuote(s: Settings, subtotal: number, cod: boolean, weightKg: number, message: string | null): ShippingQuote {
  const free = s.freeAbove != null && subtotal >= s.freeAbove;
  const codFee = cod ? s.codFee : 0;
  return {
    serviceable: true,
    message,
    source: "fallback",
    weightKg,
    rates: [
      {
        id: "aurona-standard",
        provider: BRAND,
        label: "Standard Delivery",
        eta: "3–7 business days",
        price: (free ? 0 : s.flatRate) + codFee,
        freeAbove: s.freeAbove ?? undefined,
      },
      {
        id: "aurona-express",
        provider: BRAND,
        label: "Express Delivery",
        eta: "1–3 business days",
        price: Math.round(s.flatRate * 1.9) + codFee,
      },
    ],
  };
}


/**
 * Authoritative shipping quote. Uses Shiprocket serviceability + courier rates
 * for the real cart weight; degrades to the in-house flat table only when the
 * provider is unreachable (never for "not serviceable").
 */
export async function quoteShippingForCart(opts: {
  lines: CartLine[];
  pincode: string;
  cod: boolean;
  subtotal: number;
}): Promise<ShippingQuote> {
  const pincode = opts.pincode.trim();
  const settings = await readSettings();
  const pkg = await computePackage(opts.lines, settings.defaultWeightG);

  if (!/^\d{6}$/.test(pincode)) {
    return {
      serviceable: false,
      message: "Enter a valid 6-digit Indian pincode to see delivery options.",
      source: "fallback",
      weightKg: pkg.weightKg,
      rates: [],
    };
  }

  const cacheKey = `${pincode}|${pkg.weightKg}|${opts.cod ? 1 : 0}|${Math.round(opts.subtotal)}`;
  const hit = quoteCache.get(cacheKey);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.quote;

  const pickup = await resolvePickupPincode(settings.pickupPincode);
  if (!pickup) {
    return fallbackQuote(settings, opts.subtotal, opts.cod, pkg.weightKg, null);
  }

  let quote: ShippingQuote;
  try {
    const { shiprocketAuthed } = await import("./shiprocket.server");
    const qs = new URLSearchParams({
      pickup_postcode: pickup,
      delivery_postcode: pincode,
      weight: String(pkg.weightKg),
      cod: opts.cod ? "1" : "0",
      declared_value: String(Math.max(1, Math.round(opts.subtotal))),
      length: String(pkg.dims.length),
      breadth: String(pkg.dims.breadth),
      height: String(pkg.dims.height),
    });
    const call = await shiprocketAuthed({
      stage: "serviceability",
      path: `/courier/serviceability/?${qs.toString()}`,
    });
    const couriers: Array<Record<string, unknown>> =
      (call.json?.data?.available_courier_companies as Array<Record<string, unknown>>) ?? [];

    if (!call.ok) {
      quote = fallbackQuote(settings, opts.subtotal, opts.cod, pkg.weightKg, null);
    } else if (couriers.length === 0) {
      quote = {
        serviceable: false,
        message: "Sorry, delivery is currently unavailable for this pincode.",
        source: "shiprocket",
        weightKg: pkg.weightKg,
        rates: [],
      };
    } else {
      const free = settings.freeAbove != null && opts.subtotal >= settings.freeAbove;
      const codFee = opts.cod ? settings.codFee : 0;
      // Internal candidates, keyed by the real courier id so the order can be
      // re-priced server-side later. Nothing here is shown to the customer.
      const candidates = couriers
        .map((c) => {
          const base = Number(c["rate"] ?? 0);
          const providerCod = opts.cod ? Number(c["cod_charges"] ?? 0) : 0;
          const raw = Math.round((base + providerCod) * 100) / 100;
          const days = Number(c["estimated_delivery_days"] ?? 0);
          return {
            id: `sr-${String(c["courier_company_id"] ?? c["courier_name"])}`,
            price: (free ? 0 : raw) + codFee,
            days: Number.isFinite(days) && days > 0 ? days : 7,
          };
        })
        .filter((c) => Number.isFinite(c.price));

      const cheapest = [...candidates].sort((a, b) => a.price - b.price)[0];
      const fastest = [...candidates].sort((a, b) => a.days - b.days || a.price - b.price)[0];
      const etaLabel = (d: number) => `${d} business day${d > 1 ? "s" : ""}`;

      const rates: ShippingRate[] = [];
      if (cheapest) {
        rates.push({
          id: cheapest.id,
          provider: BRAND,
          label: "Standard Delivery",
          eta: etaLabel(cheapest.days),
          price: cheapest.price,
          freeAbove: settings.freeAbove ?? undefined,
        });
      }
      if (fastest && fastest.id !== cheapest?.id && fastest.days < (cheapest?.days ?? 99)) {
        rates.push({
          id: fastest.id,
          provider: BRAND,
          label: "Express Delivery",
          eta: etaLabel(fastest.days),
          price: fastest.price,
        });
      }

      quote = {
        serviceable: rates.length > 0,
        message: rates.length > 0 ? null : "Sorry, delivery is currently unavailable for this pincode.",
        source: "shiprocket",
        weightKg: pkg.weightKg,
        rates,
      };
    }
  } catch {
    quote = fallbackQuote(settings, opts.subtotal, opts.cod, pkg.weightKg, null);
  }


  quoteCache.set(cacheKey, { quote, at: Date.now() });
  return quote;
}

/** Package weight + dimensions for an order's lines (server-only). */
export async function packageForOrderLines(lines: CartLine[]) {
  const s = await readSettings();
  return computePackage(lines, s.defaultWeightG);
}

/** Configured (or provider-resolved) pickup pincode, or null. */
export async function pickupPincodeForShipping() {
  const s = await readSettings();
  return resolvePickupPincode(s.pickupPincode);
}
