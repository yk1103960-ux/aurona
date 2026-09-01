/**
 * Server-only helpers for mobile-OTP two-factor authentication.
 *
 * The browser NEVER receives a session until the OTP is verified:
 *  - passwords are verified server-side with the password grant, and the tokens
 *    that grant returns are revoked immediately and never leave the server
 *  - only `verifyTwoFactorOtp` mints a one-time link token the browser can
 *    exchange for a real session
 * OTPs are stored as salted+peppered SHA-256 hashes, single-use and expiring.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalisePhone } from "./auth-security";

export type TwoFactorPolicy = {
  enabled: boolean;
  roles: string[];
  expirySeconds: number;
  maxAttempts: number;
  resendCooldown: number;
  maxFailures: number;
  lockMinutes: number;
};

const DEFAULT_ROLES = ["admin", "staff", "customer", "retailer", "distributor", "franchise", "student"];

export async function loadTwoFactorPolicy(supabaseAdmin: SupabaseClient): Promise<TwoFactorPolicy> {
  const { data } = await supabaseAdmin.from("site_settings").select("key, value");
  const map = new Map((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value] as const));
  const num = (k: string, d: number) => Number(map.get(k) ?? d) || d;
  const rolesRaw = (map.get("twofa_required_roles") ?? DEFAULT_ROLES.join(",")).toString();
  return {
    enabled: (map.get("twofa_sms_enabled") ?? "true").toString().toLowerCase() !== "false",
    roles: rolesRaw.split(",").map((r) => r.trim().toLowerCase()).filter(Boolean),
    expirySeconds: num("otp_expiry_seconds", 300),
    maxAttempts: num("otp_max_attempts", 5),
    resendCooldown: num("otp_resend_cooldown", 60),
    maxFailures: num("login_max_failures", 5),
    lockMinutes: num("login_lock_minutes", 15),
  };
}

/** Every role the account holds, so 2FA can be scoped per account type. */
export async function rolesForUser(supabaseAdmin: SupabaseClient, userId: string): Promise<string[]> {
  const [{ data: roleRows }, { data: profile }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    supabaseAdmin.from("profiles").select("account_type, phone").eq("id", userId).maybeSingle(),
  ]);
  const roles = new Set<string>();
  for (const r of (roleRows ?? []) as { role: string }[]) roles.add(String(r.role).toLowerCase());
  if (profile?.account_type) roles.add(String(profile.account_type).toLowerCase());
  if (roles.size === 0) roles.add("customer");
  return [...roles];
}

export function twoFactorRequired(policy: TwoFactorPolicy, roles: string[]): boolean {
  if (!policy.enabled) return false;
  return roles.some((r) => policy.roles.includes(r));
}

/** Never show the full number: +91 98765 43210 → ******3210 */
export function maskPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  return `******${digits.slice(-4)}`;
}

/** The mobile number registered on the account (profile first, then auth). */
export async function registeredPhone(supabaseAdmin: SupabaseClient, userId: string): Promise<string | null> {
  const { data: profile } = await supabaseAdmin.from("profiles").select("phone").eq("id", userId).maybeSingle();
  const candidates: (string | null | undefined)[] = [profile?.phone];
  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
  candidates.push(authUser?.user?.phone, (authUser?.user?.user_metadata as { phone?: string } | undefined)?.phone);
  for (const c of candidates) {
    if (!c) continue;
    const p = normalisePhone(String(c));
    if (p.ok && p.e164) return p.e164;
  }
  return null;
}

/** Security audit trail — never records the OTP itself. */
export async function auditTwoFactor(
  supabaseAdmin: SupabaseClient,
  entry: { identifier: string; userId?: string | null; success: boolean; reason: string; device?: string | null },
): Promise<void> {
  await supabaseAdmin
    .from("auth_login_attempts")
    .insert({
      identifier: entry.identifier.slice(0, 200),
      user_id: entry.userId ?? null,
      method: "otp",
      success: entry.success,
      reason: entry.reason.slice(0, 300),
      user_agent: entry.device ?? null,
    })
    .then(() => null, () => null);
}

/** Verifies a password WITHOUT leaving a usable session behind. */
export async function verifyPasswordServerSide(
  email: string,
  password: string,
): Promise<{ ok: boolean; userId?: string; email?: string; code?: string }> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
  if (!url || !key) return { ok: false, code: "unavailable" };

  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error_code?: string;
    error?: string;
    msg?: string;
    user?: { id?: string; email?: string };
  };
  if (!res.ok || !body.access_token || !body.user?.id) {
    return { ok: false, code: body.error_code ?? body.error ?? body.msg ?? "invalid_credentials" };
  }

  // Immediately revoke the tokens minted for this check — they never reach the browser.
  await fetch(`${url}/auth/v1/logout?scope=local`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${body.access_token}` },
  }).catch(() => null);

  return { ok: true, userId: body.user.id, email: body.user.email ?? email };
}

/** Mints the one-time token the browser exchanges for its session after OTP success. */
export async function mintSessionToken(email: string): Promise<string | null> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) return null;
  const res = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", email }),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { hashed_token?: string; properties?: { hashed_token?: string } };
  return j.hashed_token ?? j.properties?.hashed_token ?? null;
}

/** Recent-failure lockout (shared with password sign-in). */
export async function isLockedOut(
  supabaseAdmin: SupabaseClient,
  identifier: string,
  policy: TwoFactorPolicy,
): Promise<{ locked: boolean; remaining: number }> {
  const since = new Date(Date.now() - policy.lockMinutes * 60_000).toISOString();
  const { data: rows } = await supabaseAdmin
    .from("auth_login_attempts")
    .select("success, created_at")
    .eq("identifier", identifier)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);
  let failures = 0;
  for (const r of (rows ?? []) as { success: boolean }[]) {
    if (r.success) break;
    failures += 1;
  }
  return { locked: failures >= policy.maxFailures, remaining: Math.max(0, policy.maxFailures - failures) };
}
