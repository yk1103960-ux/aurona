// Server-only PhonePe helpers (credentials, signing, endpoints).
import { createHash } from "node:crypto";

export type PhonePeConfig = {
  merchantId: string;
  saltKey: string;
  saltIndex: string;
  env: "live" | "sandbox";
};

/** Reads PhonePe config from Admin → Integrations, falling back to environment secrets. */
export async function getPhonePeConfig(): Promise<PhonePeConfig | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("integrations")
    .select("enabled, config_public, config_secret_ciphertext")
    .eq("provider", "phonepe")
    .maybeSingle();

  if (data && data.enabled === false) return null;

  const pub = (data?.config_public ?? {}) as {
    merchantId?: string;
    saltIndex?: string;
    env?: string;
  };

  let saltKey: string | undefined;
  if (data?.config_secret_ciphertext) {
    try {
      const { decryptJSON } = await import("./crypto.server");
      saltKey = decryptJSON<{ saltKey?: string }>(data.config_secret_ciphertext).saltKey;
    } catch {
      saltKey = undefined;
    }
  }
  saltKey = saltKey || process.env["PHONEPE_SALT_KEY"];

  const merchantId =
    pub.merchantId || process.env["PHONEPE_MERCHANT_ID"] || process.env["PHONEPE_BUSINESS_ID"];

  if (!merchantId || !saltKey) return null;

  const envRaw = (pub.env || process.env["PHONEPE_ENV"] || "live").toLowerCase();
  return {
    merchantId,
    saltKey,
    saltIndex: String(pub.saltIndex || process.env["PHONEPE_SALT_INDEX"] || "1"),
    env: envRaw === "sandbox" || envRaw === "test" ? "sandbox" : "live",
  };
}

export function phonePeBase(env: "live" | "sandbox"): string {
  return env === "sandbox"
    ? "https://api-preprod.phonepe.com/apis/pg-sandbox"
    : "https://api.phonepe.com/apis/hermes";
}

/** X-VERIFY = sha256(payload + path + saltKey) + "###" + saltIndex */
export function xVerify(payload: string, path: string, saltKey: string, saltIndex: string): string {
  return `${createHash("sha256").update(`${payload}${path}${saltKey}`).digest("hex")}###${saltIndex}`;
}

export function merchantTxnId(orderNumber: string): string {
  return orderNumber.replace(/[^a-zA-Z0-9]/g, "").slice(0, 34) || `ORD${Date.now()}`;
}

/**
 * A *fresh* merchant order id for every payment attempt.
 * PhonePe treats `merchantOrderId` / `merchantTransactionId` as immutable: once
 * an id has been used (even for an abandoned or failed attempt) re-sending it
 * makes the hosted page load and then fail with a generic "Something went
 * wrong" when the customer picks an instrument. Retries therefore MUST use a
 * new id, while the order row keeps the id of the attempt in flight.
 */
export function newMerchantTxnId(orderNumber: string): string {
  const base = merchantTxnId(orderNumber).slice(0, 24);
  const suffix = Date.now().toString(36).toUpperCase().slice(-6);
  return `${base}${suffix}`;
}


// ---------------- PhonePe Standard Checkout v2 (OAuth) ----------------
// Newer merchants are provisioned on the v2 APIs, which use a Client ID/Secret
// pair instead of a Salt Key. The legacy hermes endpoints answer 404 for them.
export type PhonePeV2Config = {
  clientId: string;
  clientSecret: string;
  clientVersion: string;
  env: "live" | "sandbox";
};

export async function getPhonePeV2Config(): Promise<PhonePeV2Config | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("integrations")
    .select("enabled, config_public, config_secret_ciphertext")
    .eq("provider", "phonepe")
    .maybeSingle();
  if (data && data.enabled === false) return null;

  const pub = (data?.config_public ?? {}) as {
    clientId?: string;
    clientVersion?: string;
    env?: string;
  };

  let clientSecret: string | undefined;
  if (data?.config_secret_ciphertext) {
    try {
      const { decryptJSON } = await import("./crypto.server");
      clientSecret = decryptJSON<{ clientSecret?: string }>(data.config_secret_ciphertext).clientSecret;
    } catch {
      clientSecret = undefined;
    }
  }
  clientSecret = clientSecret || process.env["PHONEPE_CLIENT_SECRET"];
  const clientId = pub.clientId || process.env["PHONEPE_CLIENT_ID"];
  if (!clientId || !clientSecret) return null;

  const envRaw = (pub.env || process.env["PHONEPE_ENV"] || "live").toLowerCase();
  return {
    clientId,
    clientSecret,
    clientVersion: String(pub.clientVersion || process.env["PHONEPE_CLIENT_VERSION"] || "1"),
    env: envRaw === "sandbox" || envRaw === "test" ? "sandbox" : "live",
  };
}

function v2Hosts(env: "live" | "sandbox") {
  return env === "sandbox"
    ? {
        auth: "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token",
        pg: "https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2",
      }
    : {
        auth: "https://api.phonepe.com/apis/identity-manager/v1/oauth/token",
        pg: "https://api.phonepe.com/apis/pg/checkout/v2",
      };
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getPhonePeV2Token(cfg: PhonePeV2Config): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - 60 > Date.now() / 1000) return cachedToken.token;
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_version: cfg.clientVersion,
    client_secret: cfg.clientSecret,
    grant_type: "client_credentials",
  });
  const res = await fetch(v2Hosts(cfg.env).auth, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const j = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_at?: number;
    message?: string;
    code?: string;
  };
  if (!res.ok || !j.access_token) {
    throw new Error(j.message || j.code || `PhonePe rejected the client credentials (${res.status})`);
  }
  cachedToken = {
    token: j.access_token,
    expiresAt: j.expires_at ?? Math.floor(Date.now() / 1000) + 600,
  };
  return cachedToken.token;
}

export async function phonePeV2Pay(params: {
  cfg: PhonePeV2Config;
  merchantOrderId: string;
  amountPaise: number;
  redirectUrl: string;
  message?: string;
}): Promise<string> {
  const token = await getPhonePeV2Token(params.cfg);
  const res = await fetch(`${v2Hosts(params.cfg.env).pg}/pay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `O-Bearer ${token}`,
    },
    body: JSON.stringify({
      merchantOrderId: params.merchantOrderId,
      amount: params.amountPaise,
      expireAfter: 1200,
      paymentFlow: {
        type: "PG_CHECKOUT",
        message: params.message ?? "Aurona order payment",
        merchantUrls: { redirectUrl: params.redirectUrl },
      },
    }),
  });
  const j = (await res.json().catch(() => ({}))) as {
    redirectUrl?: string;
    message?: string;
    code?: string;
  };
  if (!res.ok || !j.redirectUrl) {
    throw new Error(j.message || j.code || `PhonePe rejected the payment request (${res.status})`);
  }
  return j.redirectUrl;
}

export async function phonePeV2Status(
  cfg: PhonePeV2Config,
  merchantOrderId: string,
): Promise<{ state: string; transactionId: string | null }> {
  const token = await getPhonePeV2Token(cfg);
  const res = await fetch(
    `${v2Hosts(cfg.env).pg}/order/${encodeURIComponent(merchantOrderId)}/status?details=false`,
    { headers: { Authorization: `O-Bearer ${token}` } },
  );
  const j = (await res.json().catch(() => ({}))) as {
    state?: string;
    orderId?: string;
    paymentDetails?: Array<{ transactionId?: string; state?: string }>;
    message?: string;
  };
  if (!res.ok) throw new Error(j.message || `PhonePe status check failed (${res.status})`);
  return {
    state: j.state ?? "PENDING",
    transactionId: j.paymentDetails?.[0]?.transactionId ?? j.orderId ?? null,
  };
}


// ---------------- Diagnostics & environment integrity ----------------

/**
 * PhonePe serves its hosted checkout from two rings:
 *   production  -> mercury.phonepe.com / api.phonepe.com
 *   test (UAT)  -> mercury-t2.phonepe.com, *-t2.phonepe.com, *preprod*
 * A merchant whose account is still provisioned in the UAT ring gets a
 * `mercury-t2` URL back even from the production API. That page loads and then
 * dies with "Something went wrong" as soon as an instrument is selected, which
 * is exactly the failure reported from the live site.
 */
export function classifyCheckoutRing(url: string): "production" | "test" | "unknown" {
  let host = "";
  try {
    host = new URL(url).host.toLowerCase();
  } catch {
    return "unknown";
  }
  if (/-t2\.|(^|\.)t2\.|preprod|sandbox|uat/.test(host)) return "test";
  if (host.endsWith("phonepe.com")) return "production";
  return "unknown";
}

export function checkoutHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/** Trims provider text so nothing secret or oversized ever reaches a log row. */
export function sanitizeProviderMessage(input: unknown): string {
  const text = typeof input === "string" ? input : JSON.stringify(input ?? "");
  return text
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[redacted]")
    .replace(/([0-9a-f]{40,})/gi, "[redacted]")
    .slice(0, 500);
}

export type PaymentEvent = {
  orderId?: string | null;
  merchantTxnId?: string | null;
  stage: "creation" | "redirect" | "verification" | "webhook" | "config_test";
  environment?: string | null;
  endpoint?: string | null;
  method?: string | null;
  status?: number | null;
  ok: boolean;
  checkoutHost?: string | null;
  amount?: number | null;
  providerCode?: string | null;
  providerMessage?: string | null;
  paymentState?: string | null;
};

/** Writes a sanitized diagnostic row. Never throws — diagnostics must not break payments. */
export async function logPaymentEvent(e: PaymentEvent): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payment_events").insert({
      provider: "phonepe",
      order_id: e.orderId ?? null,
      merchant_txn_id: e.merchantTxnId ?? null,
      stage: e.stage,
      environment: e.environment ?? null,
      endpoint: e.endpoint ?? null,
      http_method: e.method ?? null,
      http_status: e.status ?? null,
      ok: e.ok,
      checkout_host: e.checkoutHost ?? null,
      amount: e.amount ?? null,
      provider_code: e.providerCode ?? null,
      provider_message: e.providerMessage ? sanitizeProviderMessage(e.providerMessage) : null,
      payment_state: e.paymentState ?? null,
    });
  } catch {
    /* diagnostics are best-effort */
  }
}

/** Records the ring PhonePe answered with so the storefront can hide broken options. */
export async function recordCheckoutRing(ring: "production" | "test" | "unknown", note: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("integrations")
      .select("config_public")
      .eq("provider", "phonepe")
      .maybeSingle();
    const pub = (data?.config_public ?? {}) as Record<string, unknown>;
    await supabaseAdmin
      .from("integrations")
      .update({
        config_public: { ...pub, checkoutRing: ring },
        status: ring === "production" ? "connected" : "error",
        last_tested_at: new Date().toISOString(),
        last_test_message: sanitizeProviderMessage(note),
      })
      .eq("provider", "phonepe");
  } catch {
    /* best-effort */
  }
}

export type LegacyPayResult = {
  ok: boolean;
  status: number;
  code: string | null;
  message: string | null;
  url: string | null;
  endpoint: string;
};

/** Legacy (hermes) PAY_PAGE creation with full sanitized diagnostics. */
export async function phonePeLegacyPay(params: {
  cfg: PhonePeConfig;
  merchantTransactionId: string;
  merchantUserId: string;
  amountPaise: number;
  redirectUrl: string;
  callbackUrl: string;
  mobileNumber?: string;
}): Promise<LegacyPayResult> {
  const { cfg } = params;
  const payload: Record<string, unknown> = {
    merchantId: cfg.merchantId,
    merchantTransactionId: params.merchantTransactionId,
    merchantUserId: params.merchantUserId,
    amount: params.amountPaise,
    redirectUrl: params.redirectUrl,
    redirectMode: "REDIRECT",
    callbackUrl: params.callbackUrl,
    paymentInstrument: { type: "PAY_PAGE" },
  };
  if (params.mobileNumber && /^\d{10}$/.test(params.mobileNumber)) {
    payload["mobileNumber"] = params.mobileNumber;
  }
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  const path = "/pg/v1/pay";
  const endpoint = `${phonePeBase(cfg.env)}${path}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
      "X-VERIFY": xVerify(b64, path, cfg.saltKey, cfg.saltIndex),
    },
    body: JSON.stringify({ request: b64 }),
  });
  const j = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    code?: string;
    message?: string;
    data?: { instrumentResponse?: { redirectInfo?: { url?: string } } };
  };
  return {
    ok: res.ok && j.success === true && Boolean(j.data?.instrumentResponse?.redirectInfo?.url),
    status: res.status,
    code: j.code ?? null,
    message: j.message ?? null,
    url: j.data?.instrumentResponse?.redirectInfo?.url ?? null,
    endpoint,
  };
}

export type PaymentState = "COMPLETED" | "FAILED" | "PENDING" | "CANCELLED" | "EXPIRED";

export type LegacyStatusResult = {
  ok: boolean;
  status: number;
  code: string | null;
  message: string | null;
  state: PaymentState;
  transactionId: string | null;
  endpoint: string;
};

export async function phonePeLegacyStatus(
  cfg: PhonePeConfig,
  merchantTransactionId: string,
): Promise<LegacyStatusResult> {
  const path = `/pg/v1/status/${cfg.merchantId}/${merchantTransactionId}`;
  const endpoint = `${phonePeBase(cfg.env)}${path}`;
  const res = await fetch(endpoint, {
    headers: {
      "Content-Type": "application/json",
      "X-VERIFY": xVerify("", path, cfg.saltKey, cfg.saltIndex),
      "X-MERCHANT-ID": cfg.merchantId,
    },
  });
  const j = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    code?: string;
    message?: string;
    data?: { state?: string; responseCode?: string; transactionId?: string };
  };
  return {
    ok: res.ok,
    status: res.status,
    code: j.code ?? null,
    message: j.message ?? null,
    state: normalizePaymentState(j.data?.state ?? j.data?.responseCode ?? j.code ?? "PENDING"),
    transactionId: j.data?.transactionId ?? null,
    endpoint,
  };
}

/** Maps every PhonePe state/code onto the five states the UI understands. */
export function normalizePaymentState(raw: string): PaymentState {
  const s = (raw || "").toUpperCase();
  if (s === "COMPLETED" || s === "PAYMENT_SUCCESS" || s === "SUCCESS") return "COMPLETED";
  if (s.includes("CANCEL")) return "CANCELLED";
  if (s.includes("EXPIRE") || s === "TIMED_OUT") return "EXPIRED";
  if (s === "FAILED" || s === "PAYMENT_ERROR" || s === "PAYMENT_DECLINED" || s.includes("ERROR"))
    return "FAILED";
  return "PENDING";
}
