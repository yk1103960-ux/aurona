import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminPermission, writeAudit } from "@/lib/admin.server";

export const adminListAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminPermission(context, "roles.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: roles, error: roleError }, { data: assignments, error: assignmentError }, authResult] = await Promise.all([
      (supabaseAdmin as any).from("admin_roles").select("*, admin_role_permissions(permission_key)").order("name"),
      (supabaseAdmin as any).from("admin_user_roles").select("user_id, role_id, assigned_at"),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    if (roleError) throw new Error(roleError.message);
    if (assignmentError) throw new Error(assignmentError.message);
    if (authResult.error) throw new Error(authResult.error.message);
    const { data: adminRows, error: adminsError } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
    if (adminsError) throw new Error(adminsError.message);
    const adminIds = new Set((adminRows ?? []).map((row) => row.user_id));
    const users = authResult.data.users.filter((user) => adminIds.has(user.id)).map((user) => ({ id: user.id, email: user.email ?? "", created_at: user.created_at, last_sign_in_at: user.last_sign_in_at }));
    return { roles: roles ?? [], assignments: assignments ?? [], users };
  });

export const adminAssignAccessRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid(), roleId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const actor = await assertAdminPermission(context, "roles.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await (supabaseAdmin as any).from("admin_user_roles").select("role_id").eq("user_id", data.userId).maybeSingle();
    const { error } = await (supabaseAdmin as any).rpc("admin_assign_access_role", { _target_user_id: data.userId, _role_id: data.roleId, _actor_user_id: actor.userId });
    if (error) throw new Error(error.message);
    await writeAudit({ actorUserId: actor.userId, actorEmail: actor.email, action: "admin.access_role_assign", entityType: "user", entityId: data.userId, before, after: { role_id: data.roleId } });
    return { ok: true };
  });
