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

const DEFAULT_WEIGHT_G = 500;
const FALLBACK_FREE_ABOVE = 999;

type Settings = { defaultWeightG: number; freeAbove: number | null; pickupPincode: string | null };

async function readSettings(): Promise<Settings> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("site_settings")
    .select("key, value")
    .in("key", ["shipping_default_weight_g", "free_shipping_above", "shipping_pickup_pincode"]);
  const map = new Map((data ?? []).map((r) => [r.key, r.value]));
  const w = Number(map.get("shipping_default_weight_g"));
  const f = map.get("free_shipping_above");
  return {
    defaultWeightG: Number.isFinite(w) && w > 0 ? w : DEFAULT_WEIGHT_G,
    freeAbove: f == null || f === "" ? FALLBACK_FREE_ABOVE : Number(f),
    pickupPincode: map.get("shipping_pickup_pincode")?.trim() || null,
  };
}

/** Sum of real variant weights, falling back to the configured default per unit. */
async function computePackage(lines: CartLine[], defaultWeightG: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const skus = lines.map((l) => l.sku).filter(Boolean) as string[];
  const byKey = new Map<string, { weight_g: number | null; dim_l: number | null; dim_w: number | null; dim_h: number | null }>();
  if (skus.length > 0) {
    const { data } = await supabaseAdmin
      .from("product_variants")
      .select("sku, weight_g, dim_l, dim_w, dim_h")
      .in("sku", skus);
    for (const v of data ?? []) byKey.set(v.sku, v);
  }
  let grams = 0;
  let maxL = 10, maxW = 10, maxH = 5;
  for (const line of lines) {
    const v = line.sku ? byKey.get(line.sku) : undefined;
    const unit = v?.weight_g && Number(v.weight_g) > 0 ? Number(v.weight_g) : defaultWeightG;
    grams += unit * line.quantity;
    if (v?.dim_l) maxL = Math.max(maxL, Number(v.dim_l));
    if (v?.dim_w) maxW = Math.max(maxW, Number(v.dim_w));
    if (v?.dim_h) maxH = Math.max(maxH, Number(v.dim_h));
  }
  // Never send a zero-weight shipment to the courier API.
  const weightKg = Math.max(0.05, Math.round((grams / 1000) * 100) / 100);
  return { weightKg, dims: { length: maxL, breadth: maxW, height: maxH } };
}

/** Pickup pincode for the configured pickup location (cached briefly). */
let pickupCache: { pincode: string; at: number } | null = null;
async function resolvePickupPincode(configured: string | null): Promise<string | null> {
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

function fallbackQuote(subtotal: number, freeAbove: number | null, weightKg: number, message: string | null): ShippingQuote {
  const free = freeAbove != null && subtotal >= freeAbove;
  return {
    serviceable: true,
    message,
    source: "fallback",
    weightKg,
    rates: [
      {
        id: "aurona-standard",
        provider: "Aurona Logistics",
        label: "Standard delivery",
        eta: "3–7 business days",
        price: free ? 0 : 79,
        freeAbove: freeAbove ?? undefined,
      },
      {
        id: "aurona-express",
        provider: "Aurona Logistics",
        label: "Express delivery",
        eta: "1–3 business days",
        price: 149,
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
    return fallbackQuote(opts.subtotal, settings.freeAbove, pkg.weightKg, null);
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
      quote = fallbackQuote(opts.subtotal, settings.freeAbove, pkg.weightKg, null);
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
      const rates: ShippingRate[] = couriers
        .map((c) => {
          const base = Number(c["rate"] ?? 0);
          const cod = opts.cod ? Number(c["cod_charges"] ?? 0) : 0;
          const price = Math.round((base + cod) * 100) / 100;
          const days = Number(c["estimated_delivery_days"] ?? 0);
          return {
            id: `sr-${String(c["courier_company_id"] ?? c["courier_name"])}`,
            provider: String(c["courier_name"] ?? "Shiprocket"),
            label: String(c["courier_name"] ?? "Courier"),
            eta:
              typeof c["etd"] === "string" && c["etd"]
                ? `Delivery by ${String(c["etd"]).split(" ")[0]}`
                : days > 0
                  ? `${days} business day${days > 1 ? "s" : ""}`
                  : "3–7 business days",
            price: free ? 0 : price,
            freeAbove: settings.freeAbove ?? undefined,
          } satisfies ShippingRate;
        })
        .filter((r) => Number.isFinite(r.price))
        .sort((a, b) => a.price - b.price)
        .slice(0, 5);
      quote = {
        serviceable: rates.length > 0,
        message: rates.length > 0 ? null : "Sorry, delivery is currently unavailable for this pincode.",
        source: "shiprocket",
        weightKg: pkg.weightKg,
        rates,
      };
    }
  } catch {
    quote = fallbackQuote(opts.subtotal, settings.freeAbove, pkg.weightKg, null);
  }

  quoteCache.set(cacheKey, { quote, at: Date.now() });
  return quote;
}
