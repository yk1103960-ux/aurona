import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assessPassword, normalisePhone, EMAIL_RE } from "./auth-security";
import { validateEmail } from "./email-validation";
import { roleEmail } from "./role-identity";

const registrationInput = z.object({
  fullName: z.string().trim().min(3).max(80),
  email: z.string().trim().toLowerCase().max(200),
  phone: z.string().trim().max(20),
  password: z.string().min(1).max(200),
  role: z.enum(["customer", "retailer", "distributor"]).default("customer"),
});

type Issue = { field: "fullName" | "email" | "phone" | "password"; message: string };

async function hasMxRecord(domain: string): Promise<boolean> {
  try {
    const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`, {
      headers: { accept: "application/dns-json" },
    });
    if (!r.ok) return true; // fail-open on resolver trouble
    const j = (await r.json()) as { Status?: number; Answer?: { type: number; data: string }[] };
    if (j.Status === 3) return false; // NXDOMAIN
    const mx = (j.Answer ?? []).filter((a) => a.type === 15);
    if (mx.length > 0) return true;
    // Some domains accept mail on the A record only.
    const a = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`, {
      headers: { accept: "application/dns-json" },
    });
    const aj = (await a.json()) as { Answer?: unknown[] };
    return (aj.Answer ?? []).length > 0;
  } catch {
    return true;
  }
}

async function isLeakedPassword(password: string): Promise<boolean> {
  try {
    const bytes = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest("SHA-1", bytes);
    const hash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    const res = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {
      headers: { "Add-Padding": "true" },
    });
    if (!res.ok) return false;
    const body = await res.text();
    const suffix = hash.slice(5);
    return body.split("\n").some((line) => {
      const [suf, count] = line.trim().split(":");
      return suf === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}

async function emailExists(email: string): Promise<boolean> {
  try {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !key) return false;
    const res = await fetch(
      `${url}/auth/v1/admin/users?per_page=1&filter=${encodeURIComponent(email)}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) return false;
    const j = (await res.json()) as { users?: { email?: string }[] };
    return (j.users ?? []).some((u) => (u.email ?? "").toLowerCase() === email);
  } catch {
    return false;
  }
}

/** Full server-side gate that must pass before an account is created. */
export const validateRegistration = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => registrationInput.parse(input))
  .handler(async ({ data }) => {
    const issues: Issue[] = [];

    if (!/^[a-zA-Z][a-zA-Z .'-]{2,}$/.test(data.fullName)) {
      issues.push({ field: "fullName", message: "Enter your real full name (letters only)." });
    }

    const email = data.email;
    const emailCheck = validateEmail(email);
    if (!EMAIL_RE.test(email) || !emailCheck.ok) {
      issues.push({ field: "email", message: emailCheck.reason ?? "Enter a valid email address." });
    } else {
      {
        const domain = email.split("@")[1]!;
        if (!(await hasMxRecord(domain))) {
          issues.push({ field: "email", message: `“${domain}” cannot receive email. Please use a valid personal/business email address.` });
        } else if (await emailExists(roleEmail(email, data.role))) {
          issues.push({
            field: "email",
            message: `You already have a ${data.role} account with this email. Try signing in instead.`,
          });
        }
      }
    }

    const phone = normalisePhone(data.phone);
    if (!phone.ok) {
      issues.push({ field: "phone", message: phone.reason! });
    } else {
      // The same mobile number may back one account per role, never two of the same role.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const last10 = phone.e164!.slice(-10);
      const { data: dup } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("phone", `%${last10}`)
        .eq("account_type", data.role)
        .limit(1);
      if (dup && dup.length > 0) {
        issues.push({ field: "phone", message: `This mobile number already has a ${data.role} account.` });
      }
    }

    const verdict = assessPassword(data.password, {
      email: data.email,
      name: data.fullName,
      phone: data.phone,
    });
    if (!verdict.ok) {
      issues.push({ field: "password", message: verdict.problems[0] ?? "Choose a stronger password." });
    } else if (await isLeakedPassword(data.password)) {
      issues.push({ field: "password", message: "This password appeared in a known data breach. Please choose another." });
    }

    return { ok: issues.length === 0, issues, phoneE164: phone.e164 ?? null };
  });

/** Called before a password sign-in attempt: enforces lockout + blocked accounts. */
export const loginGuard = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ identifier: z.string().trim().toLowerCase().max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const settings = await loadSecuritySettings();
    const since = new Date(Date.now() - settings.lockMinutes * 60_000).toISOString();
    const { data: rows } = await supabaseAdmin
      .from("auth_login_attempts")
      .select("success, created_at")
      .eq("identifier", data.identifier)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20);
    let failures = 0;
    for (const r of rows ?? []) {
      if (r.success) break;
      failures += 1;
    }
    const locked = failures >= settings.maxFailures;
    return {
      locked,
      failures,
      remaining: Math.max(0, settings.maxFailures - failures),
      lockMinutes: settings.lockMinutes,
    };
  });

/** Records every attempt (success or failure) for lockout + admin activity log. */
export const recordLoginAttempt = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      identifier: z.string().trim().toLowerCase().max(200),
      method: z.enum(["password", "otp", "google"]).default("password"),
      success: z.boolean(),
      reason: z.string().max(300).optional(),
      device: z.string().max(300).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("auth_login_attempts").insert({
      identifier: data.identifier,
      method: data.method,
      success: data.success,
      reason: data.reason ?? null,
      user_agent: data.device ?? null,
    });
    return { ok: true };
  });

/** Runs right after a session exists: stamps security row + device session. */
export const registerSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ device: z.string().max(300).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { data: sec } = await supabaseAdmin
      .from("user_security")
      .select("blocked, blocked_reason")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (sec?.blocked) {
      return { ok: false, blocked: true, reason: sec.blocked_reason ?? "Your account has been suspended." };
    }
    await supabaseAdmin.from("user_security").upsert({
      user_id: context.userId,
      email_verified_at: (context.claims?.email_verified ? now : null) as string | null,
      failed_login_count: 0,
      locked_until: null,
      last_login_at: now,
      last_login_device: data.device ?? null,
      updated_at: now,
    });
    await supabaseAdmin.from("user_sessions").insert({
      user_id: context.userId,
      device: data.device ?? null,
      last_seen_at: now,
    });
    return { ok: true, blocked: false };
  });

/** Signs the user out of every other device by revoking their tracked sessions. */
export const revokeOtherSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("user_sessions")
      .update({ revoked_at: now })
      .eq("user_id", context.userId)
      .is("revoked_at", null);
    await supabaseAdmin.auth.admin.signOut(context.userId as string, "others" as never).catch(() => null);
    return { ok: true };
  });

async function loadSecuritySettings() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("site_settings").select("key, value");
  const map = new Map((data ?? []).map((r) => [r.key, r.value] as const));
  const num = (k: string, d: number) => Number(map.get(k) ?? d) || d;
  return {
    otpExpirySeconds: num("otp_expiry_seconds", 300),
    otpMaxAttempts: num("otp_max_attempts", 5),
    otpResendCooldown: num("otp_resend_cooldown", 60),
    maxFailures: num("login_max_failures", 5),
    lockMinutes: num("login_lock_minutes", 15),
  };
}

/** Public read of the OTP/lockout knobs so the UI matches the admin configuration. */
export const getAuthPolicy = createServerFn({ method: "GET" }).handler(async () => loadSecuritySettings());
