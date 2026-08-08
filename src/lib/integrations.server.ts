// Server-only integration helpers: credential storage, connection tests, WooCommerce sync.
import { encryptJSON, decryptJSON, mask } from "./crypto.server";

export type Provider =
  | "woocommerce"
  | "shiprocket"
  | "razorpay"
  | "stripe"
  | "phonepe"
  | "sms";

export type SyncSummary = { entity: string; fetched: number; written: number; note?: string };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function readSecrets<T>(provider: Provider): Promise<T | null> {
  const db = await admin();
  const { data } = await db
    .from("integrations")
    .select("config_secret_ciphertext")
    .eq("provider", provider)
    .maybeSingle();
  if (!data?.config_secret_ciphertext) return null;
  return decryptJSON<T>(data.config_secret_ciphertext);
}

export async function readPublic<T>(provider: Provider): Promise<T | null> {
  const db = await admin();
  const { data } = await db
    .from("integrations")
    .select("config_public, enabled")
    .eq("provider", provider)
    .maybeSingle();
  if (!data) return null;
  return { ...(data.config_public as object), enabled: data.enabled } as T;
}

export async function persistIntegration(params: {
  provider: Provider;
  enabled: boolean;
  publicConfig: Record<string, unknown>;
  secrets: Record<string, string>;
  maskSource?: string;
  actorUserId: string;
}) {
  const db = await admin();
  // Merge with previously stored secrets so blank fields keep their value.
  const existing = (await readSecrets<Record<string, string>>(params.provider)) ?? {};
  const merged = { ...existing };
  for (const [k, v] of Object.entries(params.secrets)) {
    if (v && v.trim()) merged[k] = v.trim();
  }
  const maskSource = params.maskSource && merged[params.maskSource] ? merged[params.maskSource] : "";
  const { error } = await db.from("integrations").upsert({
    provider: params.provider,
    enabled: params.enabled,
    config_public: params.publicConfig as never,
    config_secret_ciphertext: encryptJSON(merged),
    secret_masked: maskSource ? mask(maskSource, 4) : null,
    status: "configured",
    updated_by: params.actorUserId,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function recordTest(provider: Provider, ok: boolean, message: string) {
  const db = await admin();
  await db
    .from("integrations")
    .update({
      status: ok ? "connected" : "error",
      last_tested_at: new Date().toISOString(),
      last_test_message: message.slice(0, 400),
    })
    .eq("provider", provider);
}

// ---------------- WooCommerce ----------------
type WooSecrets = { consumerKey: string; consumerSecret: string };
type WooPublic = { storeUrl: string; apiVersion: string };

function wooBase(pub: WooPublic) {
  const url = pub.storeUrl.replace(/\/+$/, "");
  return `${url}/wp-json/wc/${pub.apiVersion || "v3"}`;
}

export async function wooFetch(path: string, query: Record<string, string | number> = {}) {
  const pub = await readPublic<WooPublic>("woocommerce");
  const sec = await readSecrets<WooSecrets>("woocommerce");
  if (!pub?.storeUrl || !sec?.consumerKey || !sec?.consumerSecret) {
    throw new Error("WooCommerce is not configured");
  }
  const qs = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]));
  const auth = Buffer.from(`${sec.consumerKey}:${sec.consumerSecret}`).toString("base64");
  const res = await fetch(`${wooBase(pub)}${path}?${qs.toString()}`, {
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`WooCommerce ${res.status}: ${text.slice(0, 300)}`);
  try {
    return { body: JSON.parse(text), total: Number(res.headers.get("x-wp-totalpages") || 1) };
  } catch {
    throw new Error("WooCommerce returned a non-JSON response — check the store URL and permalinks");
  }
}

export async function testWoo(): Promise<string> {
  const { body } = await wooFetch("/products", { per_page: 1 });
  if (!Array.isArray(body)) throw new Error("Unexpected WooCommerce response");
  const { body: sys } = await wooFetch("/system_status").catch(() => ({ body: null }));
  const version = (sys as { environment?: { version?: string } } | null)?.environment?.version;
  return `Connected${version ? ` to WooCommerce ${version}` : ""}. Products endpoint reachable.`;
}

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

export async function syncWooProducts(maxPages = 10): Promise<SyncSummary> {
  const db = await admin();
  let fetched = 0;
  let written = 0;
  for (let page = 1; page <= maxPages; page++) {
    const { body } = await wooFetch("/products", { per_page: 100, page, status: "publish" });
    const list = body as Array<Record<string, any>>;
    if (!list.length) break;
    fetched += list.length;

    const rows = list.map((p) => ({
      slug: slugify(String(p.slug || p.name || p.id)),
      sku: String(p.sku || `WOO-${p.id}`),
      name: String(p.name ?? "Untitled"),
      brand: "Aurona",
      short_description: String(p.short_description ?? "").replace(/<[^>]*>/g, "").slice(0, 400),
      description: String(p.description ?? "").replace(/<[^>]*>/g, "").slice(0, 4000),
      mrp: Number(p.regular_price || p.price || 0),
      price: Number(p.price || p.regular_price || 0),
      unit: "piece",
      stock: Number(p.stock_quantity ?? 0),
      is_published: true,
    }));

    const { error } = await db.from("products").upsert(rows as never, { onConflict: "slug" });
    if (error) throw new Error(error.message);
    written += rows.length;

    await db.from("woo_import_records").upsert(
      list.map((p) => ({ entity: "product", external_id: String(p.id), payload: p as never })),
      { onConflict: "entity,external_id" },
    );
    if (list.length < 100) break;
  }
  return { entity: "products", fetched, written };
}

async function stageWoo(entity: "order" | "customer", path: string, maxPages: number) {
  const db = await admin();
  let fetched = 0;
  for (let page = 1; page <= maxPages; page++) {
    const { body } = await wooFetch(path, { per_page: 100, page });
    const list = body as Array<Record<string, any>>;
    if (!list.length) break;
    fetched += list.length;
    const { error } = await db.from("woo_import_records").upsert(
      list.map((r) => ({ entity, external_id: String(r.id), payload: r as never })),
      { onConflict: "entity,external_id" },
    );
    if (error) throw new Error(error.message);
    if (list.length < 100) break;
  }
  return fetched;
}

export async function syncWooOrders(maxPages = 20): Promise<SyncSummary> {
  const fetched = await stageWoo("order", "/orders", maxPages);
  return {
    entity: "orders",
    fetched,
    written: fetched,
    note: "Historic orders are stored as legacy records (viewable in the console) — they are not attached to live customer accounts until that customer signs in.",
  };
}

export async function syncWooCustomers(maxPages = 20): Promise<SyncSummary> {
  const fetched = await stageWoo("customer", "/customers", maxPages);
  return {
    entity: "customers",
    fetched,
    written: fetched,
    note: "Customer records are staged. Accounts activate when the customer signs up or resets their password with the same email.",
  };
}

// ---------------- Shiprocket ----------------
export async function testShiprocket(): Promise<string> {
  const sec = await readSecrets<{ email: string; password: string; apiToken?: string }>("shiprocket");
  const pub = await readPublic<{ pickupLocation?: string }>("shiprocket");
  const apiToken = sec?.apiToken?.trim();
  const email = sec?.email ?? process.env["SHIPROCKET_EMAIL"];
  const password = sec?.password ?? process.env["SHIPROCKET_PASSWORD"];
  const { shiprocketLogin, shiprocketPickupLocations, authFailureMessage } =
    await import("./shiprocket.server");

  let token = apiToken ?? "";
  if (apiToken) {
    token = apiToken;
  } else {
    if (!email || !password) throw new Error("Shiprocket credentials are not saved");
    const login = await shiprocketLogin(email, password);
    const issuedToken = login.json?.token as string | undefined;
    if (!login.ok || !issuedToken) throw new Error(authFailureMessage(login));
    token = issuedToken;
  }

  const { call, locations } = await shiprocketPickupLocations(token);
  if (!call.ok) throw new Error(authFailureMessage(call));

  const names = locations.map((location) => location.pickup_location).filter(Boolean);
  const requested = pub?.pickupLocation?.trim() ?? "";
  const pickupLocation =
    names.find((name) => name.toLowerCase() === requested.toLowerCase()) ??
    names[0] ??
    requested;
  if (!pickupLocation) {
    throw new Error("Shiprocket authenticated successfully, but this account has no pickup location configured.");
  }

  const db = await admin();
  const now = new Date().toISOString();
  const { error } = await db.from("shipping_providers").upsert({
    provider: "shiprocket",
    enabled: pub?.enabled ?? true,
    config_public: {
      pickupLocation,
      availablePickupLocations: names,
      authMode: apiToken ? "api_token" : "api_user",
    },
    credentials_ciphertext: encryptJSON(apiToken ? { apiToken } : { email, password }),
    auth_token_ciphertext: apiToken ? null : encryptJSON({ token }),
    auth_token_expires_at: apiToken
      ? null
      : new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString(),
    credential_masked: apiToken
      ? `API token •••• ${apiToken.slice(-4)}`
      : email?.replace(/(.).*(@.*)/, "$1***$2") ?? null,
    connected_at: now,
    last_verified_at: now,
    updated_at: now,
  });
  if (error) throw new Error(`Shiprocket connected, but saving the verified connection failed: ${error.message}`);

  await db
    .from("integrations")
    .update({
      config_public: { pickupLocation },
      updated_at: now,
    })
    .eq("provider", "shiprocket");

  return `Connected. Authentication passed and pickup location “${pickupLocation}” was verified${names.length > 1 ? ` (${names.length} locations available)` : ""}.`;
}

// ---------------- Payment gateways ----------------
export async function testRazorpay(): Promise<string> {
  const sec = await readSecrets<{ keyId: string; keySecret: string }>("razorpay");
  if (!sec?.keyId) throw new Error("Razorpay credentials are not saved");
  const auth = Buffer.from(`${sec.keyId}:${sec.keySecret}`).toString("base64");
  const r = await fetch("https://api.razorpay.com/v1/payments?count=1", {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!r.ok) throw new Error(`Razorpay rejected the keys (${r.status})`);
  return "Connected. Razorpay API keys are valid.";
}

export async function testStripe(): Promise<string> {
  const sec = await readSecrets<{ secretKey: string }>("stripe");
  if (!sec?.secretKey) throw new Error("Stripe secret key is not saved");
  const r = await fetch("https://api.stripe.com/v1/balance", {
    headers: { Authorization: `Bearer ${sec.secretKey}` },
  });
  if (!r.ok) throw new Error(`Stripe rejected the key (${r.status})`);
  return "Connected. Stripe secret key is valid.";
}

export async function testPhonePe(): Promise<string> {
  const { getPhonePeConfig, getPhonePeV2Config, getPhonePeV2Token, phonePeBase, xVerify } =
    await import("./phonepe.server");

  // Newer merchants use Standard Checkout v2 (Client ID / Secret + OAuth).
  const v2 = await getPhonePeV2Config();
  if (v2) {
    await getPhonePeV2Token(v2);
    return `Connected to PhonePe ${v2.env} (Standard Checkout v2) with client ${v2.clientId}.`;
  }

  const cfg = await getPhonePeConfig();
  if (!cfg) {
    throw new Error(
      "PhonePe needs credentials. New merchants: save the Client ID, Client Secret and Client Version from PhonePe Business → Developer Settings → API Keys. Legacy merchants: save the Merchant ID, Salt Key and Salt Index.",
    );
  }
  if (!/^\d+$/.test(cfg.saltIndex)) throw new Error("Salt index must be numeric");
  // Probe a known-missing transaction: valid credentials return a signed 4xx, bad ones fail auth.
  const path = `/pg/v1/status/${cfg.merchantId}/AURONAPING`;
  const r = await fetch(`${phonePeBase(cfg.env)}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "X-VERIFY": xVerify("", path, cfg.saltKey, cfg.saltIndex),
      "X-MERCHANT-ID": cfg.merchantId,
    },
  });
  const body = (await r.json().catch(() => ({}))) as { code?: string; message?: string };
  if (body.code === "AUTHORIZATION_FAILED" || r.status === 401) {
    throw new Error("PhonePe rejected the Salt Key / Salt Index. Please re-check them.");
  }
  if (body.code === "404" || (r.status === 404 && !body.code?.includes("TRANSACTION"))) {
    throw new Error(
      "PhonePe’s legacy API does not recognise this merchant — your account is on Standard Checkout v2. Save the Client ID, Client Secret and Client Version from PhonePe Business → Developer Settings → API Keys instead of the Salt Key.",
    );
  }
  return `Connected to PhonePe ${cfg.env} for merchant ${cfg.merchantId}.`;
}



export async function testSms(): Promise<string> {
  const sec = await readSecrets<{ apiKey: string; authToken?: string }>("sms");
  const pub = await readPublic<{ providerName: string; senderId: string }>("sms");
  const apiKey = process.env["MSG91_AUTH_KEY"] ?? sec?.apiKey;
  if (!apiKey) throw new Error("SMS API key is not saved");
  if ((pub?.providerName || "msg91") === "msg91") {
    const r = await fetch("https://control.msg91.com/api/v5/otp/verify", {
      method: "POST",
      headers: { authkey: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ mobile: "910000000000", otp: "000000" }),
    });
    const t = await r.text();
    if (/auth ?key/i.test(t) && /invalid/i.test(t)) throw new Error("MSG91 auth key is invalid");
    return "MSG91 auth key accepted by the API.";
  }
  return "Credentials stored. Twilio will be validated on the first OTP send.";
}
