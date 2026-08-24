import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const StatusEnum = z.enum(["pending", "under_review", "approved", "rejected"]);

export const listPartnerApplications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        status: StatusEnum.optional(),
        partnerType: z.string().trim().max(40).optional(),
        search: z.string().trim().max(120).optional(),
        limit: z.number().min(1).max(300).default(200),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./admin.server");
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("partner_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status) q = q.eq("status", data.status);
    if (data.partnerType) q = q.eq("partner_type", data.partnerType as never);
    if (data.search) {
      const s = data.search.replace(/[%,]/g, "");
      q = q.or(
        `full_name.ilike.%${s}%,email.ilike.%${s}%,mobile.ilike.%${s}%,business_name.ilike.%${s}%`,
      );
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/**
 * Secure server-side status transition. Only admins can call this (assertAdmin
 * verifies the `admin` role through the caller's own authenticated client).
 * Approving a retailer/distributor application also grants the matching role.
 */
export const reviewPartnerApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        decision: StatusEnum,
        note: z.string().trim().max(1000).optional().or(z.literal("")),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin, writeAudit } = await import("./admin.server");
    const actor = await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: before, error: readErr } = await supabaseAdmin
      .from("partner_applications")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!before) throw new Error("Application not found");

    // Terminal states cannot be flipped again (prevents duplicate approvals).
    if (before.status === "approved" && data.decision === "approved") {
      return { ok: true, status: "approved", alreadyFinal: true };
    }
    if (before.status === "approved" || before.status === "rejected") {
      throw new Error(`Application is already ${before.status} and cannot be changed`);
    }

    const { data: after, error } = await supabaseAdmin
      .from("partner_applications")
      .update({
        status: data.decision,
        admin_notes: data.note ? data.note : before.admin_notes,
        reviewed_by: actor.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    // Role grant happens server-side only, never from the browser.
    if (
      data.decision === "approved" &&
      before.user_id &&
      (before.partner_type === "retailer" || before.partner_type === "distributor")
    ) {
      await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: before.user_id, role: before.partner_type },
          { onConflict: "user_id,role", ignoreDuplicates: true },
        );
      await supabaseAdmin
        .from("profiles")
        .update({ account_type: before.partner_type })
        .eq("id", before.user_id);
    }

    // #7 Applicant notification on every status decision.
    try {
      const { notifyPartnerStatus } = await import("./notify.server");
      const statusMap = {
        under_review: "under_review",
        approved: "approved",
        rejected: "rejected",
      } as const;
      const mapped = statusMap[data.decision as keyof typeof statusMap];
      if (mapped) {
        await notifyPartnerStatus({
          userId: before.user_id,
          email: before.email,
          name: before.full_name,
          partnerType: before.partner_type,
          status: mapped,
          note: data.note ?? null,
          mobile: before.mobile,
        });
      }
    } catch {
      /* notifications are never fatal */
    }

    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: `partner_application.${data.decision}`,
      entityType: "partner_applications",
      entityId: data.id,
      before: { status: before.status },
      after: { status: data.decision, note: data.note ?? null },
    });

    return { ok: true, status: after.status };
  });
