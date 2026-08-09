// Server-only OTP helpers: code hashing + SMS delivery through the configured provider.
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { readPublic, readSecrets } from "./integrations.server";

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashCode(code: string, salt: string): string {
  const pepper = process.env["MFA_ENCRYPTION_KEY"] ?? "aurona-otp";
  return createHash("sha256").update(`${salt}:${code}:${pepper}`).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * MSG91 OTP identity — verified against the live account (aurona2) on 2026-08-09.
 *
 * MSG91's /api/v5/otp `template_id` parameter expects MSG91's OWN template (flow) id,
 * NOT a DLT template id. Passing a DLT id is accepted with `type: "success"` and a
 * request_id, but MSG91 then silently drops the message and emails "SMS API Failed –
 * error code 400", so nothing reaches the handset.
 *
 *   MSG91 template (flow) id : 67978567d6fc0554473309a4   <-- send this
 *   maps to DLT template id  : 1007630933578375890
 *   DLT header / sender id   : AURONA
 *
 * Confirmed Delivered in MSG91's OTP logs with this id. Do NOT substitute a DLT id
 * (1007807652032669441 / 1077436770064246433) here.
 */
export const MSG91_TEMPLATE_ID = "67978567d6fc0554473309a4";
export const MSG91_SENDER_ID = "AURONA";

/**
 * Sends an OTP SMS through MSG91.
 * Recipient must be digits with the country code: 91XXXXXXXXXX (a bare 10-digit
 * number is mis-routed — MSG91 logs it as "Country Code Blocked" / Bahrain).
 * No silent fallbacks: the exact provider response is logged and surfaced.
 */
export async function sendSms(to: string, code: string): Promise<{ requestId: string | null }> {
  const sec = await readSecrets<{ apiKey?: string }>("sms");
  const pub = await readPublic<{ senderId?: string; templateId?: string }>("sms");
  const apiKey = sec?.apiKey ?? process.env["MSG91_AUTH_KEY"];

  if (!apiKey) {
    throw new Error("SMS OTP is not configured. An administrator must add the MSG91 auth key in Admin → Integrations.");
  }

  const templateId = (process.env["MSG91_TEMPLATE_ID"] ?? "").trim() || (pub?.templateId ?? "").trim() || MSG91_TEMPLATE_ID;
  const sender = (pub?.senderId ?? "").trim() || MSG91_SENDER_ID;

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
      body: JSON.stringify({ otp_expiry: 5 }),
    });
    text = await res.text();
  } catch {
    console.error(`[msg91] otp transport failure template=${templateId} mobile=***${mobile.slice(-4)}`);
    throw new Error("Could not reach the SMS provider. Please try again in a moment.");
  }

  let requestId: string | null = null;
  let providerMessage = "";
  let ok = res.ok;
  try {
    const j = JSON.parse(text) as { type?: string; message?: string; request_id?: string; errors?: unknown };
    requestId = j.request_id ?? null;
    providerMessage = typeof j.message === "string" ? j.message : typeof j.errors === "string" ? j.errors : "";
    if (j.type === "error") ok = false;
  } catch {
    providerMessage = text.slice(0, 200);
  }

  // Diagnostics only: endpoint, template, sender, masked recipient, status, request id and
  // the provider's own message. Never the auth key and never the OTP.
  console.info(
    `[msg91] POST /api/v5/otp ${ok ? "accepted" : "rejected"} template=${templateId} sender=${sender} mobile=***${mobile.slice(-4)} http=${res.status} request_id=${requestId ?? "none"} provider="${providerMessage || "(none)"}"`,
  );

  if (!ok) {
    throw new Error(
      providerMessage
        ? `SMS provider rejected the request: ${providerMessage}`
        : `SMS provider rejected the request (HTTP ${res.status}).`,
    );
  }
  return { requestId };
}




