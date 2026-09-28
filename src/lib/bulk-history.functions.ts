import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminPermission } from "@/lib/admin.server";

const HistoryId = z.object({ id: z.string().uuid() });

export const adminListBulkHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("admin_bulk_history")
      .select("id,action,file_name,category_name,products_processed,successful,failed,skipped,status,created_by,actor_email,created_at,archived_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminGetBulkHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => HistoryId.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin.from("admin_bulk_history").select("*").eq("id", data.id).single();
    if (result.error) throw new Error(result.error.message);
    return result.data;
  });

export const adminSetBulkHistoryArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => HistoryId.extend({ archived: z.boolean() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin.from("admin_bulk_history")
      .update({ archived_at: data.archived ? new Date().toISOString() : null })
      .eq("id", data.id).select("id").single();
    if (result.error) throw new Error(result.error.message);
    return result.data;
  });

export const adminDeleteBulkHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => HistoryId.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdminPermission(context, "catalog.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin.from("admin_bulk_history")
      .delete().eq("id", data.id).select("id").single();
    if (result.error) throw new Error(result.error.message);
    return result.data;
  });
