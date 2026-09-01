/**
 * Mobile-OTP two-factor authentication.
 *
 * Flow: email/mobile + password → server-side credential check (no session) →
 * OTP to the registered mobile → OTP verified on the server → one-time token →
 * browser exchanges it for the session → existing role-based redirect.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  generateCode,
  hashCode,
  safeEqual,
  sendSms,
  hourlyQuotaExceeded,
  invalidateOpenChallenges,
} from "./otp.server";
import {
  auditTwoFactor,
  isLockedOut,
  loadTwoFactorPolicy,
  maskPhone,
  mintSessionToken,
  registeredPhone,
  rolesForUser,
  twoFactorRequired,
  verifyPasswordServerSide,
} from "./twofactor.server";

const PURPOSE = "login2fa";

type ChallengeResult =
  | { ok: true; requires2fa: false; message?: string }
  | {
      ok: true;
      requires2fa: true;
      challengeId: string;
      maskedPhone: string;
      expirySeconds: number;
      resendCooldown: number;
      maxAttempts: number;
      message: string;
    }
  | { ok: false; requires2fa: false; message: string };

/** Creates a challenge row + sends the SMS. Shared by password and social flows. */
async function issueChallenge(
  userId: string,
  email: string,
  device?: string | null,
): Promise<ChallengeResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const policy = await loadTwoFactorPolicy(supabaseAdmin);
  const roles = await rolesForUser(supabaseAdmin, userId);

  if (!twoFactorRequired(policy, roles)) return { ok: true, requires2fa: false };

  const phone = await registeredPhone(supabaseAdmin, userId);
  if (!phone) {
    // No mobile on file — sign-in must still work; the gap is recorded for admins.
    await auditTwoFactor(supabaseAdmin, {
      identifier: email,
      userId,
      success: true,
      reason: "2fa_skipped_no_registered_mobile",
      device,
    });
    return {
      ok: true,
      requires2fa: false,
      message: "No mobile number is registered on this account, so OTP verification was skipped. Please add one in your profile.",
    };
  }

  if (await hourlyQuotaExceeded(supabaseAdmin, phone)) {
    await auditTwoFactor(supabaseAdmin, { identifier: email, userId, success: false, reason: "2fa_rate_limited", device });
    return { ok: false, requires2fa: false, message: "Too many OTP requests for this number. Please try again after an hour." };
  }

  await invalidateOpenChallenges(supabaseAdmin, { purpose: PURPOSE, email });

  const { data: row, error } = await supabaseAdmin
    .from("auth_otp_challenges")
    .insert({
      email,
      phone,
      user_id: userId,
      channel: "sms",
      purpose: PURPOSE,
      code_hash: "pending",
      expires_at: new Date(Date.now() + policy.expirySeconds * 1000).toISOString(),
    } as never)
    .select("id")
    .single();
  if (error || !row) return { ok: false, requires2fa: false, message: "Could not start verification. Please try again." };

  const code = generateCode();
  await supabaseAdmin.from("auth_otp_challenges").update({ code_hash: hashCode(code, row.id) }).eq("id", row.id);

  try {
    await sendSms(phone, code);
  } catch {
    await supabaseAdmin.from("auth_otp_challenges").delete().eq("id", row.id);
    await auditTwoFactor(supabaseAdmin, { identifier: email, userId, success: false, reason: "2fa_sms_delivery_failed", device });
    return { ok: false, requires2fa: false, message: "We could not deliver the OTP SMS. Please try again in a moment." };
  }

  await auditTwoFactor(supabaseAdmin, { identifier: email, userId, success: true, reason: "2fa_challenge_sent", device });

  return {
    ok: true,
    requires2fa: true,
    challengeId: row.id,
    maskedPhone: maskPhone(phone),
    expirySeconds: policy.expirySeconds,
    resendCooldown: policy.resendCooldown,
    maxAttempts: policy.maxAttempts,
    message: `We sent a verification code to ${maskPhone(phone)}`,
  };
}

/** Step 1 — verify the password on the server; no browser session is created. */
export const beginPasswordLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().toLowerCase().max(200),
        password: z.string().min(1).max(200),
        device: z.string().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<ChallengeResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const policy = await loadTwoFactorPolicy(supabaseAdmin);
    const lock = await isLockedOut(supabaseAdmin, data.email, policy);
    if (lock.locked) {
      return {
        ok: false,
        requires2fa: false,
        message: `Too many failed attempts. Please try again in ${policy.lockMinutes} minutes or reset your password.`,
      };
    }

    const check = await verifyPasswordServerSide(data.email, data.password);
    if (!check.ok || !check.userId) {
      await supabaseAdmin
        .from("auth_login_attempts")
        .insert({
          identifier: data.email,
          method: "password",
          success: false,
          reason: (check.code ?? "invalid_credentials").slice(0, 300),
          user_agent: data.device ?? null,
        })
        .then(() => null, () => null);
      const left = Math.max(0, lock.remaining - 1);
      if (check.code === "unavailable") {
        return { ok: false, requires2fa: false, message: "Sign-in is temporarily unavailable. Please try again shortly." };
      }
      if (/not_confirmed|not confirmed/i.test(check.code ?? "")) {
        return { ok: false, requires2fa: false, message: "Please complete the mobile OTP verification for this account before signing in." };
      }
      return {
        ok: false,
        requires2fa: false,
        message: `Incorrect email or password${left > 0 ? ` — ${left} attempt${left === 1 ? "" : "s"} left before a temporary lock` : ""}. Check you picked the right account type.`,
      };
    }

    return issueChallenge(check.userId, check.email ?? data.email, data.device);
  });

/**
 * Step 1 for Google/social sign-in: the caller already holds a provider session,
 * which the client discards immediately after this call when 2FA is required.
 */
export const beginSessionTwoFactor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ device: z.string().max(300).optional() }).parse(input ?? {}))
  .handler(async ({ data, context }): Promise<ChallengeResult> => {
    const email = (context.claims?.email as string | undefined) ?? "";
    if (!email) return { ok: true, requires2fa: false };
    return issueChallenge(context.userId as string, email, data.device);
  });

/** Resend with cooldown + hourly abuse limits enforced server-side. */
export const resendTwoFactorOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ challengeId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<ChallengeResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const policy = await loadTwoFactorPolicy(supabaseAdmin);
    const { data: rows } = await supabaseAdmin
      .from("auth_otp_challenges")
      .select("id, email, user_id, created_at")
      .eq("id", data.challengeId)
      .eq("purpose", PURPOSE)
      .limit(1);
    const ch = rows?.[0] as { email: string; user_id: string | null; created_at: string } | undefined;
    if (!ch?.user_id) return { ok: false, requires2fa: false, message: "This verification has expired. Please sign in again." };

    const waited = (Date.now() - new Date(ch.created_at).getTime()) / 1000;
    if (waited < policy.resendCooldown) {
      return {
        ok: false,
        requires2fa: false,
        message: `Please wait ${Math.ceil(policy.resendCooldown - waited)}s before requesting another code.`,
      };
    }
    return issueChallenge(ch.user_id, ch.email);
  });

/** Step 2 — verify the OTP and only then mint the session token. */
export const verifyTwoFactorOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        challengeId: z.string().uuid(),
        code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
        device: z.string().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const policy = await loadTwoFactorPolicy(supabaseAdmin);

    const { data: rows } = await supabaseAdmin
      .from("auth_otp_challenges")
      .select("id, email, user_id, code_hash, attempts, expires_at, consumed_at")
      .eq("id", data.challengeId)
      .eq("purpose", PURPOSE)
      .limit(1);
    const ch = rows?.[0] as
      | { id: string; email: string; user_id: string | null; code_hash: string; attempts: number | null; expires_at: string; consumed_at: string | null }
      | undefined;

    if (!ch || ch.consumed_at) {
      return { ok: false as const, message: "This code is no longer valid. Please request a new one." };
    }
    if (new Date(ch.expires_at).getTime() < Date.now()) {
      await auditTwoFactor(supabaseAdmin, { identifier: ch.email, userId: ch.user_id, success: false, reason: "2fa_expired", device: data.device });
      return { ok: false as const, message: "This code has expired. Please request a new one." };
    }
    if ((ch.attempts ?? 0) >= policy.maxAttempts) {
      return { ok: false as const, message: "Too many incorrect attempts. Please request a fresh code." };
    }
    if (!safeEqual(ch.code_hash, hashCode(data.code, ch.id))) {
      const attempts = (ch.attempts ?? 0) + 1;
      await supabaseAdmin.from("auth_otp_challenges").update({ attempts }).eq("id", ch.id);
      if (attempts >= policy.maxAttempts) {
        await supabaseAdmin.from("auth_otp_challenges").update({ consumed_at: new Date().toISOString() }).eq("id", ch.id);
      }
      await auditTwoFactor(supabaseAdmin, { identifier: ch.email, userId: ch.user_id, success: false, reason: "2fa_incorrect_code", device: data.device });
      const left = Math.max(0, policy.maxAttempts - attempts);
      return {
        ok: false as const,
        attemptsLeft: left,
        message: left > 0
          ? `Incorrect code — ${left} attempt${left === 1 ? "" : "s"} left.`
          : "Too many incorrect attempts. Please request a fresh code.",
      };
    }

    // Single-use: consume before the session token is minted.
    await supabaseAdmin.from("auth_otp_challenges").update({ consumed_at: new Date().toISOString() }).eq("id", ch.id);

    const tokenHash = await mintSessionToken(ch.email);
    if (!tokenHash) {
      await auditTwoFactor(supabaseAdmin, { identifier: ch.email, userId: ch.user_id, success: false, reason: "2fa_session_mint_failed", device: data.device });
      return { ok: false as const, message: "Verified, but sign-in could not be completed. Please try again." };
    }

    const now = new Date().toISOString();
    if (ch.user_id) {
      await supabaseAdmin
        .from("user_security")
        .upsert({ user_id: ch.user_id, phone_verified_at: now, updated_at: now } as never)
        .then(() => null, () => null);
    }
    await auditTwoFactor(supabaseAdmin, { identifier: ch.email, userId: ch.user_id, success: true, reason: "2fa_verified", device: data.device });

    return { ok: true as const, message: "Verified — signing you in…", tokenHash };
  });

/** Read-only view of the 2FA configuration for the admin console. */
export const getTwoFactorConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const policy = await loadTwoFactorPolicy(supabaseAdmin);
  return { enabled: policy.enabled, roles: policy.roles, expirySeconds: policy.expirySeconds, maxAttempts: policy.maxAttempts, resendCooldown: policy.resendCooldown };
});
