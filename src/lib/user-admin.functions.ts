import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

type AuthUser = {
  id: string;
  email: string | null;
  phone: string | null;
  email_confirmed_at: string | null;
  phone_confirmed_at: string | null;
  last_sign_in_at: string | null;
  created_at: string;
};

async function fetchAuthUsers(): Promise<AuthUser[]> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) return [];
  const out: AuthUser[] = [];
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=200`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) break;
    const j = (await res.json()) as { users?: AuthUser[] };
    const users = j.users ?? [];
    out.push(...users);
    if (users.length < 200) break;
  }
  return out;
}

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ search: z.string().max(120).optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [authUsers, profiles, security, roles] = await Promise.all([
      fetchAuthUsers(),
      supabaseAdmin.from("profiles").select("id, full_name, phone, business_name, account_type, created_at"),
      supabaseAdmin.from("user_security").select("*"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);
    const pMap = new Map((profiles.data ?? []).map((p) => [p.id, p]));
    const sMap = new Map((security.data ?? []).map((s) => [s.user_id, s]));
    const rMap = new Map<string, string[]>();
    for (const r of roles.data ?? []) {
      rMap.set(r.user_id, [...(rMap.get(r.user_id) ?? []), r.role as string]);
    }
    const term = (data.search ?? "").trim().toLowerCase();
    const rows = authUsers
      .map((u) => {
        const p = pMap.get(u.id);
        const s = sMap.get(u.id);
        return {
          id: u.id,
          email: u.email,
          phone: u.phone ?? p?.phone ?? null,
          fullName: p?.full_name ?? null,
          businessName: p?.business_name ?? null,
          accountType: p?.account_type ?? "customer",
          roles: rMap.get(u.id) ?? [],
          emailVerified: !!u.email_confirmed_at,
          phoneVerified: !!u.phone_confirmed_at,
          blocked: !!s?.blocked,
          blockedReason: s?.blocked_reason ?? null,
          lastSignInAt: u.last_sign_in_at,
          lastLoginDevice: s?.last_login_device ?? null,
          createdAt: u.created_at,
        };
      })
      .filter((r) =>
        !term ||
        [r.email, r.phone, r.fullName, r.businessName].some((v) => (v ?? "").toLowerCase().includes(term)),
      )
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return rows;
  });

export const adminSetUserBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), blocked: z.boolean(), reason: z.string().max(300).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    await supabaseAdmin.from("user_security").upsert({
      user_id: data.userId,
      blocked: data.blocked,
      blocked_reason: data.blocked ? (data.reason ?? "Suspended by admin") : null,
      blocked_at: data.blocked ? now : null,
      updated_at: now,
    });
    // Banning in Auth stops new tokens immediately; unbanning restores access.
    await supabaseAdmin.auth.admin
      .updateUserById(data.userId, { ban_duration: data.blocked ? "876000h" : "none" } as never)
      .catch(() => null);
    if (data.blocked) {
      await supabaseAdmin.from("user_sessions").update({ revoked_at: now }).eq("user_id", data.userId).is("revoked_at", null);
    }
    await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: context.userId,
      action: data.blocked ? "user.block" : "user.unblock",
      entity_type: "user",
      entity_id: data.userId,
      after: { reason: data.reason ?? null } as any,
    });
    return { ok: true };
  });

export const adminResetVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.auth.admin
      .updateUserById(data.userId, { email_confirm: false } as never)
      .catch(() => null);
    await supabaseAdmin.from("user_security").upsert({
      user_id: data.userId,
      email_verified_at: null,
      updated_at: new Date().toISOString(),
    });
    await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: context.userId,
      action: "user.reset_verification",
      entity_type: "user",
      entity_id: data.userId,
    });
    return { ok: true };
  });

export const adminLoginActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ identifier: z.string().max(200).optional(), limit: z.number().min(1).max(200).default(50) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("auth_login_attempts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.identifier) q = q.ilike("identifier", `%${data.identifier}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const SECURITY_KEYS = [
  "otp_expiry_seconds",
  "otp_max_attempts",
  "otp_resend_cooldown",
  "login_max_failures",
  "login_lock_minutes",
  "block_fake_emails",
] as const;

export const adminGetSecuritySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("site_settings").select("key, value").in("key", SECURITY_KEYS as unknown as string[]);
    return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  });

export const adminSaveSecuritySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.record(z.string(), z.string()).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = Object.entries(data)
      .filter(([k]) => (SECURITY_KEYS as readonly string[]).includes(k))
      .map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }));
    if (rows.length) await supabaseAdmin.from("site_settings").upsert(rows);
    await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: context.userId,
      action: "security.settings_update",
      entity_type: "site_settings",
      after: data as any,
    });
    return { ok: true };
  });
