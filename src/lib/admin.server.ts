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
  const { resolveShiprocketToken } = await import("./shiprocket.server");
  return resolveShiprocketToken();
}
