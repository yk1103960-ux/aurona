import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { IntegrationProviderSchema } from "./integration.schemas";

/** Admin-only listing. Never returns ciphertext or plaintext secrets. */
export const listIntegrations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertIntegrationAdmin } = await import("./integration-auth.server");
    await assertIntegrationAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("integrations")
      .select(
        "provider, enabled, status, config_public, secret_masked, last_tested_at, last_test_message, last_sync_at, last_sync_summary, updated_at",
      );
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        provider: IntegrationProviderSchema,
        enabled: z.boolean().default(false),
        publicConfig: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
        secrets: z.record(z.string(), z.string().max(500)).default({}),
        maskSource: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertIntegrationAdmin } = await import("./integration-auth.server");
    const userId = await assertIntegrationAdmin(context);
    const { persistIntegration } = await import("./integrations.server");
    return persistIntegration({
      provider: data.provider,
      enabled: data.enabled,
      publicConfig: data.publicConfig,
      secrets: data.secrets,
      maskSource: data.maskSource,
      actorUserId: userId,
    });
  });

export const testIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ provider: IntegrationProviderSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertIntegrationAdmin } = await import("./integration-auth.server");
    await assertIntegrationAdmin(context);
    const mod = await import("./integrations.server");
    const runners: Record<string, () => Promise<string>> = {
      woocommerce: mod.testWoo,
      shiprocket: mod.testShiprocket,
      razorpay: mod.testRazorpay,
      stripe: mod.testStripe,
      phonepe: mod.testPhonePe,
      sms: mod.testSms,
    };
    try {
      const message = await runners[data.provider]!();
      await mod.recordTest(data.provider, true, message);
      return { ok: true, message };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Connection failed";
      await mod.recordTest(data.provider, false, message);
      return { ok: false, message };
    }
  });

export const syncWooEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ entity: z.enum(["products", "orders", "customers"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertIntegrationAdmin } = await import("./integration-auth.server");
    await assertIntegrationAdmin(context);
    const mod = await import("./integrations.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      const summary =
        data.entity === "products"
          ? await mod.syncWooProducts()
          : data.entity === "orders"
            ? await mod.syncWooOrders()
            : await mod.syncWooCustomers();
      await supabaseAdmin
        .from("integrations")
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_summary: summary as never,
          status: "connected",
        })
        .eq("provider", "woocommerce");
      return { ok: true as const, ...summary };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed";
      return { ok: false as const, entity: data.entity, fetched: 0, written: 0, note: message };
    }
  });

export const wooImportStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertIntegrationAdmin } = await import("./integration-auth.server");
    await assertIntegrationAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const entities = ["product", "order", "customer"] as const;
    const out: Record<string, number> = {};
    for (const e of entities) {
      const { count } = await supabaseAdmin
        .from("woo_import_records")
        .select("id", { count: "exact", head: true })
        .eq("entity", e);
      out[e] = count ?? 0;
    }
    return out;
  });

/** Public: newsletter signup. */
export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        source: z.string().trim().max(40).default("footer"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("newsletter_subscribers")
      .upsert({ email: data.email.toLowerCase(), source: data.source }, { onConflict: "email" });
    if (error) throw new Error("Could not save your email, please try again");
    return { ok: true };
  });
