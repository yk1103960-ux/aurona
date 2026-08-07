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
