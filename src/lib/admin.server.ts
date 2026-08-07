export async function assertAdmin(context: { supabase: any; userId: string; claims: any }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
  return { userId: context.userId, email: (context.claims?.email as string) ?? null };
}

export async function writeAudit(params: {
  actorUserId: string;
  actorEmail: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("audit_logs").insert({
    actor_user_id: params.actorUserId,
    actor_email: params.actorEmail,
    action: params.action,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
    before: (params.before ?? null) as never,
    after: (params.after ?? null) as never,
  });
}

export async function getShiprocketToken(): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { decryptJSON, encryptJSON } = await import("./crypto.server");
  const { data: row } = await supabaseAdmin
    .from("shipping_providers")
    .select("credentials_ciphertext, auth_token_ciphertext, auth_token_expires_at")
    .eq("provider", "shiprocket")
    .maybeSingle();

  const stillValid = row?.auth_token_ciphertext && row.auth_token_expires_at &&
    new Date(row.auth_token_expires_at).getTime() > Date.now() + 60_000;
  if (stillValid && row?.auth_token_ciphertext) {
    return decryptJSON<{ token: string }>(row.auth_token_ciphertext).token;
  }

  const credentialsCiphertext = row?.credentials_ciphertext;
  const stored = credentialsCiphertext
    ? decryptJSON<{ email: string; password: string }>(credentialsCiphertext)
    : null;
  const email = stored?.email ?? process.env["SHIPROCKET_EMAIL"];
  const password = stored?.password ?? process.env["SHIPROCKET_PASSWORD"];
  if (!email || !password) throw new Error("Shiprocket is not connected");

  const response = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const payload = await response.json() as { token?: string; message?: string };
  if (!response.ok || !payload.token) {
    const blocked = /blocked|too many failed/i.test(payload.message ?? "");
    throw new Error(blocked
      ? "Shiprocket temporarily blocked this account after failed sign-in attempts. Reset/unblock it in Shiprocket, then reconnect once."
      : payload.message || `Shiprocket authentication failed (${response.status})`);
  }

  if (row?.credentials_ciphertext) {
    await supabaseAdmin.from("shipping_providers").update({
      auth_token_ciphertext: encryptJSON({ token: payload.token }),
      auth_token_expires_at: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString(),
      last_verified_at: new Date().toISOString(),
    }).eq("provider", "shiprocket");
  }
  return payload.token;
}