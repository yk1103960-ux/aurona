import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminPermission } from "@/lib/admin.server";

export const adminGetReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ from: z.string().date(), to: z.string().date() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminPermission(context, "reports.view");
    const from = new Date(`${data.from}T00:00:00.000Z`);
    const to = new Date(`${data.to}T00:00:00.000Z`);
    to.setUTCDate(to.getUTCDate() + 1);
    if (to <= from) throw new Error("End date must not be before start date");
    if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) throw new Error("Report range cannot exceed one year");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: report, error } = await (supabaseAdmin as any).rpc("admin_report_summary", { _from: from.toISOString(), _to: to.toISOString() });
    if (error) throw new Error(error.message);
    return report;
  });
