import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminPermission } from "@/lib/admin.server";

export const adminGetReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ from: z.string().date(), to: z.string().date() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdminPermission(context, "reports.view");
    const from = new Date(`${data.from}T00:00:00.000Z`);
    const to = new Date(`${data.to}T00:00:00.000Z`);
    to.setUTCDate(to.getUTCDate() + 1);
    if (to <= from) throw new Error("End date must not be before start date");
    if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000)
      throw new Error("Report range cannot exceed one year");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: report, error } = await (supabaseAdmin as any).rpc("admin_report_summary", {
      _from: from.toISOString(),
      _to: to.toISOString(),
    });
    if (error) throw new Error(error.message);
    const range = (query: any) =>
      query.gte("created_at", from.toISOString()).lt("created_at", to.toISOString());
    const [customers, returns, coupons, payments, wishlist] = await Promise.all([
      range((supabaseAdmin as any).from("profiles").select("id,account_type", { count: "exact" })),
      range((supabaseAdmin as any).from("return_requests").select("status,kind,refund_amount")),
      (supabaseAdmin as any)
        .from("coupons")
        .select("code,type,value,times_used,active,archived_at")
        .order("times_used", { ascending: false })
        .limit(20),
      range(
        (supabaseAdmin as any).from("payment_events").select("provider,payment_state,amount,ok"),
      ),
      (supabaseAdmin as any)
        .from("wishlist_items")
        .select("product_id,products(name,sku)")
        .limit(1000),
    ]);
    for (const result of [customers, returns, coupons, payments, wishlist])
      if (result.error) throw new Error(result.error.message);
    const countBy = (rows: any[], key: string) =>
      Object.entries(
        rows.reduce((out: Record<string, number>, row: any) => {
          const value = String(row[key] ?? "unknown");
          out[value] = (out[value] ?? 0) + 1;
          return out;
        }, {}),
      ).map(([name, count]) => ({ name, count }));
    const wishMap = new Map<
      string,
      { product_id: string; name: string; sku: string; count: number }
    >();
    for (const row of wishlist.data ?? []) {
      const product = row.products ?? {};
      const item = wishMap.get(row.product_id) ?? {
        product_id: row.product_id,
        name: product.name ?? "Unknown product",
        sku: product.sku ?? "",
        count: 0,
      };
      item.count += 1;
      wishMap.set(row.product_id, item);
    }
    return {
      ...report,
      customer_registrations: customers.count ?? 0,
      customer_types: countBy(customers.data ?? [], "account_type"),
      returns: countBy(returns.data ?? [], "status"),
      return_refund_total: (returns.data ?? []).reduce(
        (sum: number, row: any) => sum + Number(row.refund_amount ?? 0),
        0,
      ),
      coupons: coupons.data ?? [],
      gateway_payments: countBy(payments.data ?? [], "payment_state"),
      payment_providers: countBy(payments.data ?? [], "provider"),
      wishlist: [...wishMap.values()].sort((a, b) => b.count - a.count).slice(0, 20),
    };
  });
