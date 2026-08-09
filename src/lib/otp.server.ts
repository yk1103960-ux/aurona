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
 * Production SMS identity.
 * DLT (Airtel) approved header/sender: AURONA.
 * Airtel DLT approved template id: 1077436770064246433 — preferred, used as soon as
 * MSG91 has that template synced on the account.
 * 1007807652032669441 is the template MSG91 currently accepts on this auth key and is
 * kept as an automatic fallback so OTP delivery never breaks during a DLT sync gap.
 */
export const MSG91_DLT_TEMPLATE_ID = "1077436770064246433";
export const MSG91_FALLBACK_TEMPLATE_ID = "1007807652032669441";
export const MSG91_SENDER_ID = "AURONA";

type SendResult = { requestId: string | null; templateId: string };

async function postOtp(apiKey: string, templateId: string, mobile: string, code: string, sender: string) {
  const url = new URL("https://control.msg91.com/api/v5/otp");
  url.searchParams.set("template_id", templateId);
  url.searchParams.set("mobile", mobile);
  url.searchParams.set("otp", code); // maps to MSG91's ##OTP## variable
  url.searchParams.set("sender", sender);
  url.searchParams.set("realTimeResponse", "1");

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { authkey: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ otp_expiry: 5 }),
  });
  const text = await res.text();

  let requestId: string | null = null;
  let message = "";
  let ok = res.ok;
  try {
    const j = JSON.parse(text) as { type?: string; message?: string; request_id?: string; errors?: unknown };
    requestId = j.request_id ?? null;
    message = typeof j.message === "string" ? j.message : typeof j.errors === "string" ? j.errors : "";
    if (j.type === "error") ok = false;
  } catch {
    message = text.slice(0, 200);
  }
  return { ok, requestId, message, status: res.status };
}

/** Sends an OTP SMS through MSG91 using the DLT-verified AURONA template. */
export async function sendSms(to: string, code: string): Promise<SendResult> {
  const sec = await readSecrets<{ apiKey?: string }>("sms");
  const pub = await readPublic<{ senderId?: string; templateId?: string }>("sms");
  const apiKey = sec?.apiKey ?? process.env["MSG91_AUTH_KEY"];

  if (!apiKey) {
    throw new Error("SMS OTP is not configured. An administrator must add the MSG91 auth key in Admin → Integrations.");
  }

  const sender = (pub?.senderId ?? "").trim() || MSG91_SENDER_ID;
  const digits = to.replace(/\D/g, "");
  // MSG91 routes on the full country code; always send 91XXXXXXXXXX for Indian numbers.
  const mobile = digits.length === 10 ? `91${digits}` : digits;

  const candidates = [
    (process.env["MSG91_TEMPLATE_ID"] ?? "").trim(),
    (pub?.templateId ?? "").trim(),
    MSG91_DLT_TEMPLATE_ID,
    MSG91_FALLBACK_TEMPLATE_ID,
  ].filter((t, i, a) => t && a.indexOf(t) === i);

  let last = { message: "", status: 0 };
  for (const templateId of candidates) {
    let attempt: Awaited<ReturnType<typeof postOtp>>;
    try {
      attempt = await postOtp(apiKey, templateId, mobile, code, sender);
    } catch {
      throw new Error("Could not reach the SMS provider. Please try again in a moment.");
    }
    // Diagnostics only — mobile tail and provider request id; never the OTP or the auth key.
    console.info(
      `[msg91] otp ${attempt.ok ? "accepted" : "rejected"} template=${templateId} sender=${sender} mobile=***${mobile.slice(-4)} status=${attempt.status} request_id=${attempt.requestId ?? "none"}${attempt.message ? ` provider="${attempt.message}"` : ""}`,
    );
    if (attempt.ok) return { requestId: attempt.requestId, templateId };
    last = { message: attempt.message, status: attempt.status };
    // Only a template problem is worth retrying with the next candidate.
    if (!/template/i.test(attempt.message)) break;
  }

  throw new Error(
    last.message
      ? `SMS provider rejected the request: ${last.message}`
      : `SMS provider rejected the request (HTTP ${last.status}).`,
  );
}



