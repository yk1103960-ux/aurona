// Server-only OTP helpers: code hashing + SMS delivery through the configured provider.
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashCode(code: string, salt: string): string {
  const pepper = process.env["MFA_ENCRYPTION_KEY"];
  if (!pepper) throw new Error("OTP verification is temporarily unavailable");
  return createHash("sha256").update(`${salt}:${code}:${pepper}`).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export const OTP_EXPIRY_SECONDS = 600;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN = 60;
export const OTP_MAX_PER_HOUR = 5;

/**
 * MSG91 OTP identity.
 *
 * MSG91's /api/v5/otp `template_id` parameter expects MSG91's OWN template (flow) id,
 * NOT a DLT template id. A DLT id here returns `type: "success"` + request_id and is
 * then dropped, so nothing reaches the handset.
 *
 *   MSG91 template (flow) id : 6a7826ee25e4a56c84021ea2   <-- send this
 *   maps to DLT template id  : 1077436770064246433
 *   DLT header / sender id   : AURONA
 * The flow's ##OTP## placeholder is mapped by MSG91 to the approved DLT
 * {#numeric#} variable. There is intentionally no fallback template.
 */
export const MSG91_TEMPLATE_ID = "6a7826ee25e4a56c84021ea2";
export const MSG91_DLT_TEMPLATE_ID = "1077436770064246433";
export const MSG91_SENDER_ID = "AURONA";



export async function findAuthUser(email: string): Promise<{ id: string; confirmed: boolean } | null> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) return null;
  const res = await fetch(`${url}/auth/v1/admin/users?per_page=5&filter=${encodeURIComponent(email)}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { users?: { id: string; email?: string; email_confirmed_at?: string | null }[] };
  const hit = (body.users ?? []).find((user) => (user.email ?? "").toLowerCase() === email.toLowerCase());
  return hit ? { id: hit.id, confirmed: Boolean(hit.email_confirmed_at) } : null;
}

export async function hourlyQuotaExceeded(supabaseAdmin: SupabaseClient, phoneE164: string): Promise<boolean> {
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await supabaseAdmin
    .from("auth_otp_challenges")
    .select("id", { count: "exact", head: true })
    .eq("phone", phoneE164)
    .gte("created_at", since);
  return (count ?? 0) >= OTP_MAX_PER_HOUR;
}

function maskMobile(mobile: string): string {
  return `+91******${mobile.slice(-4)}`;
}

/**
 * Sends an OTP SMS through MSG91.
 * Recipient must be digits with the country code: 91XXXXXXXXXX (a bare 10-digit
 * number is mis-routed — MSG91 logs it as "Country Code Blocked" / Bahrain).
 * No silent fallbacks: the exact provider response is logged and surfaced.
 */
export async function sendSms(to: string, code: string): Promise<{ requestId: string | null }> {
  const apiKey = process.env["MSG91_AUTH_KEY"];

  if (!apiKey) {
    console.error("[msg91] configuration_error reason=missing_auth_key");
    throw new Error("SMS OTP could not be sent. Please try again.");
  }

  // MSG91 v5 expects its own synced OTP template/Flow ID in `template_id`, not
  // the numeric Airtel DLT ID. This is deliberately fixed with no fallback.
  const templateId = MSG91_TEMPLATE_ID;
  const sender = MSG91_SENDER_ID;

  const digits = to.replace(/\D/g, "");
  const mobile = digits.length === 10 ? `91${digits}` : digits;
  if (!/^91\d{10}$/.test(mobile)) {
    throw new Error("Enter a valid 10-digit Indian mobile number.");
  }

  const url = new URL("https://control.msg91.com/api/v5/otp");
  url.searchParams.set("template_id", templateId);
  url.searchParams.set("mobile", mobile);
  url.searchParams.set("otp", code); // fills the template's ##OTP## variable
  url.searchParams.set("sender", sender);
  url.searchParams.set("realTimeResponse", "1");

  let res: Response;
  let text: string;
  try {
    res = await fetch(url.toString(), {
      method: "POST",
      headers: { authkey: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ otp_expiry: 10 }),
    });
    text = await res.text();
  } catch {
    console.error(
      `[msg91] transport_error template=${templateId} dlt=${MSG91_DLT_TEMPLATE_ID} sender=${sender} recipient=${maskMobile(mobile)}`,
    );
    throw new Error("SMS OTP could not be sent. Please try again.");
  }

  let requestId: string | null = null;
  let providerMessage = "";
  let providerType = "";
  let ok = false;
  try {
    const j = JSON.parse(text) as { type?: string; message?: unknown; request_id?: string; errors?: unknown };
    requestId = j.request_id ?? null;
    providerType = j.type ?? "";
    providerMessage =
      typeof j.message === "string"
        ? j.message
        : typeof j.errors === "string"
          ? j.errors
          : j.message || j.errors
            ? JSON.stringify(j.message ?? j.errors).slice(0, 240)
            : "";
    ok = res.ok && providerType.toLowerCase() === "success" && Boolean(requestId);
  } catch {
    providerMessage = text.slice(0, 200);
  }

  const diagnostic =
    `[msg91] ${ok ? "accepted" : "rejected"} endpoint=/api/v5/otp template=${templateId} ` +
    `dlt=${MSG91_DLT_TEMPLATE_ID} sender=${sender} recipient=${maskMobile(mobile)} http=${res.status} ` +
    `type=${providerType || "none"} request_id=${requestId ?? "none"} provider=${JSON.stringify(providerMessage || "(none)")}`;
  if (ok) console.info(diagnostic);
  else console.error(diagnostic);

  // Safe admin diagnostic: no auth key, recipient, or OTP is persisted.
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("integrations")
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_message:
          `Template ID used: ${templateId} · Sender: ${sender} · ` +
          `MSG91 response: HTTP ${res.status}, ${providerType || "unknown"}, request ${requestId ?? "none"}`,
        status: ok ? "connected" : "error",
      })
      .eq("provider", "sms");
  } catch {
    console.error(`[msg91] diagnostic_persist_failed template=${templateId} sender=${sender}`);
  }

  if (!ok) {
    throw new Error("SMS OTP could not be sent. Please try again.");
  }
  return { requestId };
}




