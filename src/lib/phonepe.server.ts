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

