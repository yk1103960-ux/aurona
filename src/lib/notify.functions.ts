import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * #6 — sends the signed-in user a security alert after a sensitive change.
 * The email is taken from the verified token claims, never from client input.
 */
export const notifySecurityEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        change: z.enum(["password", "email", "mobile"]),
        device: z.string().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const email = (context.claims?.email as string | undefined) ?? null;
    if (!email) return { ok: false };
    const { notifySecurityChange } = await import("./notify.server");
    const { writeAudit } = await import("./admin.server");
    await notifySecurityChange({
      userId: context.userId,
      email,
      change: data.change,
      device: data.device ?? null,
    });
    await writeAudit({
      actorUserId: context.userId,
      actorEmail: email,
      action: `account.${data.change}_changed`,
      entityType: "auth.users",
      entityId: context.userId,
    }).catch(() => null);
    return { ok: true };
  });
