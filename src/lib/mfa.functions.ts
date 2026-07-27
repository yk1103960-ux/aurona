import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ISSUER = "Aurona Admin";

export const mfaStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("user_mfa")
      .select("verified_at, last_used_at")
      .eq("user_id", context.userId).maybeSingle();
    return { enrolled: !!data?.verified_at, lastUsedAt: data?.last_used_at ?? null };
  });

export const mfaBegin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { generateSecret, generateURI } = await import("otplib");
    const QRCode = (await import("qrcode")).default;
    const { encryptString } = await import("./crypto.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const secret = generateSecret();
    const email = (context.claims?.email as string) ?? "admin";
    const otpauth = generateURI({ issuer: ISSUER, label: email, secret });
    const qrDataUrl = await QRCode.toDataURL(otpauth);

    await supabaseAdmin.from("user_mfa").upsert({
      user_id: context.userId,
      secret_ciphertext: encryptString(secret),
      verified_at: null,
      updated_at: new Date().toISOString(),
    });
    return { otpauth, qrDataUrl, secret };
  });

export const mfaConfirm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ token: z.string().regex(/^\d{6}$/) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { verify } = await import("otplib");
    const { decryptString, encryptJSON } = await import("./crypto.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("user_mfa").select("secret_ciphertext").eq("user_id", context.userId).maybeSingle();
    if (!row?.secret_ciphertext) throw new Error("Start enrolment first");
    const secret = decryptString(row.secret_ciphertext);
    const result = await verify({ token: data.token, secret });
    if (!result?.valid) throw new Error("Incorrect code");

    const codes = Array.from({ length: 8 }, () =>
      Math.random().toString(36).slice(2, 6).toUpperCase() + "-" +
      Math.random().toString(36).slice(2, 6).toUpperCase()
    );
    await supabaseAdmin.from("user_mfa").update({
      verified_at: new Date().toISOString(),
      backup_codes_ciphertext: encryptJSON({ codes, used: [] as string[] }),
      last_used_at: new Date().toISOString(),
    }).eq("user_id", context.userId);
    return { ok: true, backupCodes: codes };
  });

export const mfaVerify = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ token: z.string().min(6).max(12) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { verify } = await import("otplib");
    const { decryptString, decryptJSON, encryptJSON } = await import("./crypto.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("user_mfa")
      .select("secret_ciphertext, verified_at, backup_codes_ciphertext")
      .eq("user_id", context.userId).maybeSingle();
    if (!row?.verified_at) throw new Error("MFA not enrolled");
    const secret = decryptString(row.secret_ciphertext);
    const clean = data.token.replace(/[\s-]/g, "");
    let ok = false;
    if (/^\d{6}$/.test(clean)) {
      const r = await verify({ token: clean, secret });
      ok = !!r?.valid;
    }
    if (!ok && row.backup_codes_ciphertext) {
      const store = decryptJSON<{ codes: string[]; used: string[] }>(row.backup_codes_ciphertext);
      const codeUpper = data.token.trim().toUpperCase();
      if (store.codes.includes(codeUpper) && !store.used.includes(codeUpper)) {
        ok = true;
        store.used.push(codeUpper);
        await supabaseAdmin.from("user_mfa").update({
          backup_codes_ciphertext: encryptJSON(store),
        }).eq("user_id", context.userId);
      }
    }
    if (!ok) throw new Error("Incorrect code");
    await supabaseAdmin.from("user_mfa").update({
      last_used_at: new Date().toISOString(),
    }).eq("user_id", context.userId);
    return { ok: true };
  });

export const mfaDisable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ token: z.string().regex(/^\d{6}$/) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { verify } = await import("otplib");
    const { decryptString } = await import("./crypto.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("user_mfa")
      .select("secret_ciphertext").eq("user_id", context.userId).maybeSingle();
    if (!row?.secret_ciphertext) throw new Error("MFA not enrolled");
    const r = await verify({ token: data.token, secret: decryptString(row.secret_ciphertext) });
    if (!r?.valid) throw new Error("Incorrect code");
    await supabaseAdmin.from("user_mfa").delete().eq("user_id", context.userId);
    return { ok: true };
  });
