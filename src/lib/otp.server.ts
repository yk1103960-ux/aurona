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

/** Sends an SMS through whichever provider the admin saved in Admin → Integrations. */
export async function sendSms(to: string, message: string): Promise<void> {
  const sec = await readSecrets<{ apiKey?: string; authToken?: string; accountSid?: string }>("sms");
  const pub = await readPublic<{ providerName?: string; senderId?: string; templateId?: string }>("sms");
  const provider = (pub?.providerName ?? "").toLowerCase();
  const apiKey = sec?.apiKey ?? process.env["MSG91_AUTH_KEY"];

  if (!apiKey) {
    throw new Error(
      "SMS OTP is not configured yet. Please choose “Email OTP”, or ask an administrator to add SMS credentials in Admin → Integrations.",
    );
  }

  if (provider.includes("twilio")) {
    const sid = sec?.accountSid ?? apiKey;
    const token = sec?.authToken ?? "";
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: pub?.senderId ?? "", Body: message }),
    });
    if (!res.ok) throw new Error(`SMS delivery failed (${res.status}). Please try Email OTP.`);
    return;
  }

  // Default: MSG91. In India, carriers only deliver against a DLT-approved
  // template, so without a template ID MSG91 accepts the request and returns
  // "success" while the message is silently dropped. Refuse instead of lying.
  const code = message.match(/\d{6}/)?.[0] ?? message;
  const mobile = to.replace(/\D/g, "");
  const templateId = (pub?.templateId ?? process.env["MSG91_TEMPLATE_ID"] ?? "").trim();
  if (!templateId) {
    throw new Error(
      "SMS OTP can’t be delivered yet — the SMS provider still needs a DLT-approved template ID. Please use “Email OTP” for now, or add the template ID in Admin → Integrations → SMS / OTP.",
    );
  }

  const url = new URL("https://control.msg91.com/api/v5/otp");

  // MSG91 routes on the full country code; a bare 10-digit Indian number is
  // mis-detected as another country and blocked, so always send 91XXXXXXXXXX.
  const normalized = mobile.length === 10 ? `91${mobile}` : mobile;
  url.searchParams.set("mobile", normalized);
  url.searchParams.set("otp", code);
  url.searchParams.set("template_id", templateId);
  if (pub?.senderId?.trim()) url.searchParams.set("sender", pub.senderId.trim());

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { authkey: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ otp_expiry: 5 }),
  });
  const text = await res.text();
  let ok = res.ok;
  try {
    const j = JSON.parse(text) as { type?: string; message?: string };
    ok = res.ok && j.type !== "error";
    if (!ok) throw new Error(`SMS delivery failed: ${j.message ?? text}. Please try Email OTP.`);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("SMS delivery failed")) throw err;
    if (!res.ok) throw new Error(`SMS delivery failed (${res.status}). Please try Email OTP.`);
  }
}

