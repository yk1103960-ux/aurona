import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * IMPORTANT:
 * Your `partner_applications.status` column must allow:
 * pending | under_review | approved | rejected | disabled
 *
 * If Supabase has a CHECK constraint / enum that does not include `disabled`,
 * add `disabled` there before using Temporary Disable.
 */
const StatusEnum = z.enum(["pending", "under_review", "approved", "rejected", "disabled"]);

async function removePartnerRole(supabaseAdmin: any, userId: string | null, partnerType: string | null) {
  if (!userId) return;
  if (partnerType !== "retailer" && partnerType !== "distributor") return;

  await supabaseAdmin.from("user_roles").delete().eq("user_id", userId).eq("role", partnerType);

  // Do not force another account type here because we do not know the user's
  // previous account type. The application status controls access.
}

async function grantPartnerRole(supabaseAdmin: any, userId: string | null, partnerType: string | null) {
  if (!userId) return;
  if (partnerType !== "retailer" && partnerType !== "distributor") return;

  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: userId, role: partnerType }, { onConflict: "user_id,role", ignoreDuplicates: true });

  await supabaseAdmin.from("profiles").update({ account_type: partnerType }).eq("id", userId);
}

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
      q = q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,mobile.ilike.%${s}%,business_name.ilike.%${s}%`);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/**
 * Status rules:
 *
 * pending / under_review:
 *   -> under_review
 *   -> approved
 *   -> rejected
 *
 * approved:
 *   -> disabled
 *
 * disabled:
 *   -> approved
 *
 * rejected:
 *   final; delete only
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

    const current = String(before.status ?? "pending");
    const next = data.decision;

    // Same-status click: harmless.
    if (current === next) {
      return { ok: true, status: current, unchanged: true };
    }

    const allowed =
      (current === "pending" && (next === "under_review" || next === "approved" || next === "rejected")) ||
      (current === "under_review" && (next === "approved" || next === "rejected")) ||
      (current === "approved" && next === "disabled") ||
      (current === "disabled" && next === "approved");

    if (!allowed) {
      if (current === "approved") {
        throw new Error("Approved applications cannot be rejected. Use Temporary Disable or Delete.");
      }

      if (current === "rejected") {
        throw new Error("Rejected applications cannot be changed. Use Delete if required.");
      }

      throw new Error(`Cannot change application from ${current} to ${next}`);
    }

    const { data: after, error } = await supabaseAdmin
      .from("partner_applications")
      .update({
        status: next,
        admin_notes: data.note ? data.note : before.admin_notes,
        reviewed_by: actor.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    // Grant access only when approved.
    if (next === "approved") {
      await grantPartnerRole(supabaseAdmin, before.user_id ?? null, before.partner_type ?? null);
    }

    // Temporary disable immediately removes retailer/distributor access role.
    if (next === "disabled") {
      await removePartnerRole(supabaseAdmin, before.user_id ?? null, before.partner_type ?? null);
    }

    // Applicant notifications.
    try {
      const { notifyPartnerStatus } = await import("./notify.server");

      if (next === "under_review" || next === "approved" || next === "rejected") {
        await notifyPartnerStatus({
          userId: before.user_id,
          email: before.email,
          name: before.full_name,
          partnerType: before.partner_type,
          status: next,
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
      action: `partner_application.${next}`,
      entityType: "partner_applications",
      entityId: data.id,
      before: { status: current },
      after: { status: next, note: data.note ?? null },
    });

    return { ok: true, status: after.status };
  });

/**
 * Permanently delete a partner application.
 *
 * This is intended for approved / rejected / disabled applications from Admin.
 * If the application had already granted a retailer/distributor role,
 * that role is removed before deleting the application record.
 */
export const deletePartnerApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
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

    // Pending applications should be handled with Approve/Reject first.
    if (before.status === "pending" || before.status === "under_review") {
      throw new Error("Pending applications cannot be deleted. Approve or reject the application first.");
    }

    await removePartnerRole(supabaseAdmin, before.user_id ?? null, before.partner_type ?? null);

    const { error: deleteErr } = await supabaseAdmin.from("partner_applications").delete().eq("id", data.id);

    if (deleteErr) throw new Error(deleteErr.message);

    await writeAudit({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: "partner_application.delete",
      entityType: "partner_applications",
      entityId: data.id,
      before: {
        status: before.status,
        partner_type: before.partner_type,
        user_id: before.user_id,
      },
      after: {
        deleted: true,
        note: data.note ?? null,
      },
    });

    return { ok: true };
  });
