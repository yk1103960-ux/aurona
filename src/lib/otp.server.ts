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

  // Default: MSG91 flow API (India)
  const res = await fetch("https://control.msg91.com/api/v5/flow/", {
    method: "POST",
    headers: { authkey: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      template_id: pub?.templateId ?? "",
      sender: pub?.senderId ?? "AURONA",
      short_url: 0,
      recipients: [{ mobiles: to.replace(/^\+/, ""), OTP: message.match(/\d{6}/)?.[0] ?? message }],
    }),
  });
  if (!res.ok) throw new Error(`SMS delivery failed (${res.status}). Please try Email OTP.`);
}
