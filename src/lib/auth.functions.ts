import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  findAuthUser,
  generateCode,
  hashCode,
  hourlyQuotaExceeded,
  OTP_EXPIRY_SECONDS,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN,
  safeEqual,
  sendSms,
  invalidateOpenChallenges,
} from "./otp.server";
import { assessPassword, normalisePhone, EMAIL_RE, looksFakeEmail } from "./auth-security";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Sends a 6-digit code by SMS to the mobile number used at registration. */
export const sendSignupSmsOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email().max(200),
        phone: z.string().trim().max(20),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const p = normalisePhone(data.phone);
    if (!p.ok) return { ok: false, message: p.reason ?? "Enter a valid mobile number." };
    const phoneE164 = p.e164;
    if (!phoneE164) return { ok: false, message: "Enter a valid mobile number." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (await hourlyQuotaExceeded(supabaseAdmin, phoneE164)) {
      return { ok: false, message: "Too many OTP requests for this number. Please try again after an hour." };
    }

    const { data: recent } = await supabaseAdmin
      .from("auth_otp_challenges")
      .select("created_at")
      .eq("email", data.email)
      .order("created_at", { ascending: false })
      .limit(1);
    const last = recent?.[0]?.created_at ? new Date(recent[0].created_at).getTime() : 0;
    const waited = (Date.now() - last) / 1000;
    if (last && waited < OTP_RESEND_COOLDOWN) {
      return {
        ok: false,
        message: `Please wait ${Math.ceil(OTP_RESEND_COOLDOWN - waited)}s before requesting another code.`,
      };
    }

    await invalidateOpenChallenges(supabaseAdmin, { purpose: "signup", email: data.email });
    const code = generateCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000).toISOString();
    const { data: row, error } = await supabaseAdmin
      .from("auth_otp_challenges")
      .insert({
        email: data.email,
        phone: phoneE164,
        channel: "sms",
        purpose: "signup",
        code_hash: "pending",
        expires_at: expiresAt,
      })
      .select("id")
      .single();
    if (error || !row) return { ok: false, message: "Could not start verification. Please try again." };

    await supabaseAdmin
      .from("auth_otp_challenges")
      .update({ code_hash: hashCode(code, row.id) })
      .eq("id", row.id);

    try {
      await sendSms(phoneE164, code);
    } catch (err: unknown) {
      await supabaseAdmin.from("auth_otp_challenges").delete().eq("id", row.id);
      return { ok: false, message: "SMS OTP could not be sent. Please try again.", fallback: "email" as const };
    }

    return {
      ok: true,
      message: "SMS OTP request accepted.",
      expirySeconds: OTP_EXPIRY_SECONDS,
      maxAttempts: OTP_MAX_ATTEMPTS,
    };
  });

/**
 * Verifies the SMS code. Only on success is the freshly created account confirmed —
 * until then Auth refuses every sign-in, so the site cannot be accessed without OTP.
 */
export const verifySignupSmsOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email().max(200),
        code: z
          .string()
          .trim()
          .regex(/^\d{6}$/),
        fullName: z.string().trim().min(3).max(80),
        phone: z.string().trim().max(20),
        password: z.string().min(1).max(200),
        businessName: z.string().trim().max(160).optional(),
        role: z.enum(["customer", "retailer", "distributor"]).default("customer"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows } = await supabaseAdmin
      .from("auth_otp_challenges")
      .select("id, code_hash, attempts, expires_at, consumed_at, phone")
      .eq("email", data.email)
      .eq("purpose", "signup")
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    const ch = rows?.[0];
    if (!ch) return { ok: false, message: "No active code. Please request a new one." };
    if (new Date(ch.expires_at).getTime() < Date.now()) {
      return { ok: false, message: "This code has expired. Please request a new one." };
    }
    if ((ch.attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
      return { ok: false, message: "Too many incorrect attempts. Please request a new code." };
    }

    if (!safeEqual(ch.code_hash, hashCode(data.code, ch.id))) {
      const attempts = (ch.attempts ?? 0) + 1;
      await supabaseAdmin.from("auth_otp_challenges").update({ attempts }).eq("id", ch.id);
      const left = Math.max(0, OTP_MAX_ATTEMPTS - attempts);
      return {
        ok: false,
        message:
          left > 0
            ? `Incorrect code — ${left} attempt${left === 1 ? "" : "s"} left.`
            : "Too many incorrect attempts. Please request a new code.",
        attemptsLeft: left,
      };
    }

    const normalized = normalisePhone(data.phone);
    if (!normalized.ok || !normalized.e164) {
      return { ok: false, message: normalized.reason ?? "Enter a valid mobile number." };
    }
    if (ch.phone && normalized.e164 !== ch.phone) {
      return { ok: false, message: "The mobile number does not match this verification request." };
    }

    const verdict = assessPassword(data.password, {
      email: data.email,
      name: data.fullName,
      phone: data.phone,
    });
    if (!verdict.ok) {
      return { ok: false, message: verdict.problems[0] ?? "Choose a stronger password." };
    }

    // Clean up only abandoned UNVERIFIED users left by the old flow.
    const existing = await findAuthUser(data.email);
    if (existing) {
      const verified = Boolean((existing as any).email_confirmed_at || (existing as any).phone_confirmed_at);
      if (verified) {
        return { ok: false, message: "This account is already registered. Please sign in instead." };
      }

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(existing.id);
      if (deleteError) {
        return {
          ok: false,
          message: "An unfinished registration already exists. Please try again later.",
        };
      }
    }

    // Create the real Auth user ONLY after the OTP is correct.
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      phone: normalized.e164,
      phone_confirm: true,
      user_metadata: {
        full_name: data.fullName,
        phone: normalized.e164,
        business_name: data.businessName ?? "",
        intended_role: data.role,
      },
    } as never);

    const user = created?.user;
    if (createError || !user) {
      return {
        ok: false,
        message: createError?.message ?? "Account could not be created. Please try again.",
      };
    }

    const now = new Date().toISOString();

    await supabaseAdmin.from("auth_otp_challenges").update({ consumed_at: now }).eq("id", ch.id);

    await supabaseAdmin.from("user_security").upsert({
      user_id: user.id,
      email_verified_at: now,
      phone_verified_at: now,
      updated_at: now,
    } as never);

    try {
      const { notifyWelcome } = await import("./notify.server");
      await notifyWelcome({
        userId: user.id,
        email: data.email,
        name: data.fullName,
        mobile: normalized.e164,
      });
    } catch {
      /* notifications are never fatal */
    }

    // Mint a one-time token so the browser can establish a session immediately.
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !key) {
      return { ok: false, message: "Account created, but automatic sign-in is temporarily unavailable." };
    }

    const linkRes = await fetch(`${url}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "magiclink", email: data.email }),
    });

    if (!linkRes.ok) {
      return { ok: false, message: "Account created, but automatic sign-in could not be completed." };
    }

    const linkJson = (await linkRes.json()) as {
      hashed_token?: string;
      properties?: { hashed_token?: string };
    };
    const tokenHash = linkJson.hashed_token ?? linkJson.properties?.hashed_token;

    if (!tokenHash) {
      return { ok: false, message: "Account created, but automatic sign-in could not be completed." };
    }

    return {
      ok: true,
      message: "Mobile verified — account created.",
      tokenHash,
    };
  });

/** Sends a login code by SMS using our own provider (Supabase has no phone provider). */
export const sendLoginSmsOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        phone: z.string().trim().max(20),
        role: z.enum(["customer", "retailer", "distributor"]).default("customer"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const p = normalisePhone(data.phone);
    if (!p.ok) return { ok: false, message: p.reason ?? "Enter a valid mobile number." };
    const phoneE164 = p.e164;
    if (!phoneE164) return { ok: false, message: "Enter a valid mobile number." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const last10 = phoneE164.slice(-10);
    if (await hourlyQuotaExceeded(supabaseAdmin, phoneE164)) {
      return { ok: false, message: "Too many OTP requests for this number. Please try again after an hour." };
    }

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("phone", `%${last10}`)
      .eq("account_type", data.role)
      .limit(1);
    const userId = prof?.[0]?.id;
    if (!userId) {
      return { ok: false, message: `No ${data.role} account found with this mobile number. Please register first.` };
    }

    const { data: recent } = await supabaseAdmin
      .from("auth_otp_challenges")
      .select("created_at")
      .eq("phone", phoneE164)
      .eq("purpose", "login")
      .order("created_at", { ascending: false })
      .limit(1);
    const last = recent?.[0]?.created_at ? new Date(recent[0].created_at).getTime() : 0;
    const waited = (Date.now() - last) / 1000;
    if (last && waited < OTP_RESEND_COOLDOWN) {
      return {
        ok: false,
        message: `Please wait ${Math.ceil(OTP_RESEND_COOLDOWN - waited)}s before requesting another code.`,
      };
    }

    await invalidateOpenChallenges(supabaseAdmin, { purpose: "login", phone: phoneE164 });
    const code = generateCode();
    const { data: row, error } = await supabaseAdmin
      .from("auth_otp_challenges")
      .insert({
        email: `sms:${phoneE164}`,
        phone: phoneE164,
        channel: "sms",
        purpose: "login",
        code_hash: "pending",
        expires_at: new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000).toISOString(),
      })
      .select("id")
      .single();
    if (error || !row) return { ok: false, message: "Could not start verification. Please try again." };
    await supabaseAdmin
      .from("auth_otp_challenges")
      .update({ code_hash: hashCode(code, row.id) })
      .eq("id", row.id);

    try {
      await sendSms(phoneE164, code);
    } catch (err: unknown) {
      await supabaseAdmin.from("auth_otp_challenges").delete().eq("id", row.id);
      return { ok: false, message: "SMS OTP could not be sent. Please try again.", fallback: "email" as const };
    }
    return {
      ok: true,
      message: "SMS OTP request accepted.",
      expirySeconds: OTP_EXPIRY_SECONDS,
      maxAttempts: OTP_MAX_ATTEMPTS,
    };
  });

/** Verifies a login code and returns a one-time token the browser exchanges for a session. */
export const verifyLoginSmsOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        phone: z.string().trim().max(20),
        code: z
          .string()
          .trim()
          .regex(/^\d{6}$/),
        role: z.enum(["customer", "retailer", "distributor"]).default("customer"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const p = normalisePhone(data.phone);
    if (!p.ok) return { ok: false, message: p.reason ?? "Enter a valid mobile number." };
    const phoneE164 = p.e164;
    if (!phoneE164) return { ok: false, message: "Enter a valid mobile number." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows } = await supabaseAdmin
      .from("auth_otp_challenges")
      .select("id, code_hash, attempts, expires_at")
      .eq("phone", phoneE164)
      .eq("purpose", "login")
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
    const ch = rows?.[0];
    if (!ch) return { ok: false, message: "No active code. Please request a new one." };
    if (new Date(ch.expires_at).getTime() < Date.now())
      return { ok: false, message: "This code has expired. Please request a new one." };
    if ((ch.attempts ?? 0) >= OTP_MAX_ATTEMPTS)
      return { ok: false, message: "Too many incorrect attempts. Please request a new code." };
    if (!safeEqual(ch.code_hash, hashCode(data.code, ch.id))) {
      const attempts = (ch.attempts ?? 0) + 1;
      await supabaseAdmin.from("auth_otp_challenges").update({ attempts }).eq("id", ch.id);
      const left = Math.max(0, OTP_MAX_ATTEMPTS - attempts);
      return {
        ok: false,
        message:
          left > 0
            ? `Incorrect code — ${left} attempt${left === 1 ? "" : "s"} left.`
            : "Too many incorrect attempts. Please request a new code.",
      };
    }

    const last10 = phoneE164.slice(-10);
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("phone", `%${last10}`)
      .eq("account_type", data.role)
      .limit(1);
    const userId = prof?.[0]?.id;
    if (!userId) return { ok: false, message: `No ${data.role} account found with this mobile number.` };

    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !key) return { ok: false, message: "Sign-in is temporarily unavailable. Please try your password." };

    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = userRes?.user?.email;
    if (!email) return { ok: false, message: "This account has no email on file. Please sign in with your password." };

    // Mark the phone verified and mint a one-time link token for the browser.
    await supabaseAdmin.auth.admin
      .updateUserById(userId, { phone_confirm: true, email_confirm: true } as never)
      .catch(() => null);

    const res = await fetch(`${url}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "magiclink", email }),
    });
    if (!res.ok) return { ok: false, message: "Could not complete sign-in. Please try your password." };
    const j = (await res.json()) as { hashed_token?: string; properties?: { hashed_token?: string } };
    const tokenHash = j.hashed_token ?? j.properties?.hashed_token;
    if (!tokenHash) return { ok: false, message: "Could not complete sign-in. Please try your password." };

    await supabaseAdmin.from("auth_otp_challenges").update({ consumed_at: new Date().toISOString() }).eq("id", ch.id);
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("user_security")
      .upsert({ user_id: userId, phone_verified_at: now, updated_at: now } as never);

    return { ok: true, message: "Verified — signing you in…", tokenHash, email };
  });

/** Client-visible OTP / lockout policy so the UI counts down with the same numbers the server enforces. */
export const getAuthPolicy = createServerFn({ method: "GET" }).handler(async () => ({
  otpExpirySeconds: OTP_EXPIRY_SECONDS,
  otpMaxAttempts: OTP_MAX_ATTEMPTS,
  otpResendCooldown: OTP_RESEND_COOLDOWN,
  maxFailures: 5,
  lockMinutes: 15,
}));

/** Pre-flight registration validation: password strength, email sanity, per-role duplicates. */
export const validateRegistration = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        fullName: z.string().trim().max(120),
        email: z.string().trim().toLowerCase().max(200),
        phone: z.string().trim().max(20),
        password: z.string().max(200),
        role: z.enum(["customer", "retailer", "distributor"]).default("customer"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const issues: { field: string; message: string }[] = [];

    if (data.fullName.length < 3) issues.push({ field: "name", message: "Enter your full name." });
    if (!EMAIL_RE.test(data.email)) issues.push({ field: "email", message: "Enter a valid email address." });
    else {
      const fake = looksFakeEmail(data.email);
      if (fake.fake) issues.push({ field: "email", message: fake.reason ?? "Enter a real email address." });
    }

    const p = normalisePhone(data.phone);
    if (!p.ok || !p.e164) {
      issues.push({ field: "phone", message: p.reason ?? "Enter a valid 10-digit Indian mobile number." });
    }

    const verdict = assessPassword(data.password, {
      email: data.email,
      name: data.fullName,
      phone: data.phone,
    });
    if (!verdict.ok) {
      issues.push({ field: "password", message: verdict.problems[0] ?? "Choose a stronger password." });
    }

    if (!issues.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const existing = await findAuthUser(data.email);
      if (existing) {
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("account_type")
          .eq("id", existing.id)
          .maybeSingle();
        const verified = Boolean((existing as any).email_confirmed_at || (existing as any).phone_confirmed_at);
        if (verified && (prof?.account_type ?? "customer") === data.role) {
          issues.push({
            field: "email",
            message: `A ${data.role} account already exists with this email. Please sign in instead.`,
          });
        }
      }
    }

    return { ok: issues.length === 0, issues };
  });

/** Security audit trail for sign-in attempts. Never fatal. */
export const recordLoginAttempt = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        identifier: z.string().trim().max(200),
        method: z.enum(["password", "otp", "google"]).default("password"),
        success: z.boolean().default(false),
        reason: z.string().max(300).optional(),
        device: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("auth_login_attempts")
      .insert({
        identifier: data.identifier || "unknown",
        method: data.method,
        success: data.success,
        reason: data.reason ?? null,
        user_agent: data.device ?? null,
      })
      .then(
        () => null,
        () => null,
      );
    return { ok: true };
  });

/** Records the signed-in device and reports whether the account is suspended. */
export const registerSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ device: z.string().max(200).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();

    const { data: sec } = await supabaseAdmin
      .from("user_security")
      .select("blocked, blocked_reason")
      .eq("user_id", userId)
      .maybeSingle();

    if (sec?.blocked) {
      return { ok: false, blocked: true, reason: sec.blocked_reason ?? "Your account has been suspended." };
    }

    await supabaseAdmin
      .from("user_sessions")
      .insert({ user_id: userId, device: data.device ?? null, last_seen_at: now })
      .then(
        () => null,
        () => null,
      );

    await supabaseAdmin
      .from("user_security")
      .upsert({ user_id: userId, last_login_device: data.device ?? null, updated_at: now } as never)
      .then(
        () => null,
        () => null,
      );

    return { ok: true, blocked: false, reason: null as string | null };
  });

/**
 * Live account status for the signed-in session. Used by the client to force a
 * sign-out the moment an admin blocks (or deletes) the account.
 */
export const getAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(context.userId as string);
    if (!userRes?.user) {
      return { valid: false, reason: "Your account is no longer available." };
    }
    if ((userRes.user as any).banned_until && new Date((userRes.user as any).banned_until).getTime() > Date.now()) {
      return { valid: false, reason: "Your account has been suspended." };
    }
    const { data: sec } = await supabaseAdmin
      .from("user_security")
      .select("blocked, blocked_reason")
      .eq("user_id", context.userId as string)
      .maybeSingle();
    if (sec?.blocked) {
      return { valid: false, reason: sec.blocked_reason ?? "Your account has been suspended." };
    }
    return { valid: true, reason: null as string | null };
  });
