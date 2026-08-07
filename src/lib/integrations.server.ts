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
  if (!sec) throw new Error("Shiprocket credentials are not saved");
  if (sec.apiToken) {
    const r = await fetch("https://apiv2.shiprocket.in/v1/external/orders?per_page=1", {
      headers: { Authorization: `Bearer ${sec.apiToken}` },
    });
    if (!r.ok) throw new Error(`Shiprocket token rejected (${r.status})`);
    return "Connected using the saved API token.";
  }
  const r = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: sec.email, password: sec.password }),
  });
  const j = (await r.json()) as { token?: string; message?: string };
  if (!r.ok || !j.token) throw new Error(j.message || "Shiprocket rejected the credentials");
  return `Connected as ${sec.email}.`;
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
  const sec = await readSecrets<{ saltKey: string }>("phonepe");
  const pub = await readPublic<{ merchantId: string; saltIndex: string; env: string }>("phonepe");
  if (!sec?.saltKey || !pub?.merchantId) throw new Error("PhonePe credentials are not saved");
  // PhonePe has no read-only ping endpoint; validate the credential shape instead.
  if (!/^\d+$/.test(String(pub.saltIndex || "1"))) throw new Error("Salt index must be numeric");
  return `Credentials stored for merchant ${pub.merchantId} (${pub.env || "sandbox"}). A live payment attempt will confirm end to end.`;
}

export async function testSms(): Promise<string> {
  const sec = await readSecrets<{ apiKey: string; authToken?: string }>("sms");
  const pub = await readPublic<{ providerName: string; senderId: string }>("sms");
  if (!sec?.apiKey) throw new Error("SMS API key is not saved");
  if ((pub?.providerName || "msg91") === "msg91") {
    const r = await fetch("https://control.msg91.com/api/v5/otp/verify", {
      method: "POST",
      headers: { authkey: sec.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ mobile: "910000000000", otp: "000000" }),
    });
    const t = await r.text();
    if (/auth ?key/i.test(t) && /invalid/i.test(t)) throw new Error("MSG91 auth key is invalid");
    return "MSG91 auth key accepted by the API.";
  }
  return "Credentials stored. Twilio will be validated on the first OTP send.";
}
