/**
 * Server-side source of truth for retailer / distributor access.
 *
 * Google (or any) authentication only proves identity. Whether a session may
 * open the retailer or distributor dashboard is decided here, from the
 * database, on every request — never from client state.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PartnerRole = "retailer" | "distributor";
/** none = no application yet, pending = awaiting admin, rejected, approved */
export type PartnerState = "none" | "pending" | "under_review" | "rejected" | "approved";

const roleInput = z.object({ role: z.enum(["retailer", "distributor"]) });

async function loadState(uid: string, email: string | null, role: PartnerRole) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let app: Record<string, any> | null = null;
  const { data: own } = await supabaseAdmin
    .from("partner_applications")
    .select("*")
    .eq("user_id", uid)
    .eq("partner_type", role as never)
    .order("created_at", { ascending: false })
    .limit(1);
  app = own?.[0] ?? null;

  // Legacy rows submitted before sign-in are matched (and linked) by email.
  if (!app && email) {
    const { data: byEmail } = await supabaseAdmin
      .from("partner_applications")
      .select("*")
      .ilike("email", email)
      .eq("partner_type", role as never)
      .order("created_at", { ascending: false })
      .limit(1);
    if (byEmail?.[0]) {
      app = byEmail[0];
      await supabaseAdmin.from("partner_applications").update({ user_id: uid }).eq("id", app!.id);
    }
  }

  const { data: roleRows } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", uid)
    .eq("role", role as never)
    .limit(1);
  const hasRole = (roleRows ?? []).length > 0;

  const status = (app?.status as string | undefined) ?? null;
  const state: PartnerState =
    status === "approved" && hasRole
      ? "approved"
      : !status
        ? "none"
        : status === "rejected"
          ? "rejected"
          : status === "under_review"
            ? "under_review"
            : "pending";

  return { state, application: app };
}

/** Both partner states for the signed-in user. Authoritative, server-checked. */
export const getAccessState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims?.email as string | undefined) ?? null;
    const [retailer, distributor] = await Promise.all([
      loadState(context.userId as string, email, "retailer"),
      loadState(context.userId as string, email, "distributor"),
    ]);
    return {
      email,
      retailer: retailer.state,
      distributor: distributor.state,
    };
  });

/** Application + prefill data for the requested role's form. */
export const getPartnerApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => roleInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = (context.claims?.email as string | undefined) ?? null;
    const { state, application } = await loadState(context.userId as string, email, data.role);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, phone, business_name, gstin")
      .eq("id", context.userId as string)
      .maybeSingle();

    return {
      role: data.role,
      state,
      email,
      application: application
        ? {
            id: application.id as string,
            status: application.status as string,
            created_at: application.created_at as string,
            admin_notes: (application.admin_notes as string | null) ?? null,
            business_name: (application.business_name as string | null) ?? null,
          }
        : null,
      prefill: {
        full_name: (application?.full_name as string | null) ?? profile?.full_name ?? "",
        mobile: (application?.mobile as string | null) ?? profile?.phone ?? "",
        business_name: (application?.business_name as string | null) ?? profile?.business_name ?? "",
        gstin: (application?.gstin as string | null) ?? profile?.gstin ?? "",
      },
    };
  });

const applicationInput = roleInput.extend({
  full_name: z.string().trim().min(3).max(120),
  mobile: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  business_name: z.string().trim().min(2).max(160),
  owner_name: z.string().trim().max(160).optional().or(z.literal("")),
  business_type: z.string().trim().max(80).optional().or(z.literal("")),
  gstin: z.string().trim().max(20).optional().or(z.literal("")),
  pan: z.string().trim().max(20).optional().or(z.literal("")),
  address: z.string().trim().min(6).max(400),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pincode: z.string().trim().regex(/^\d{6}$/, "Enter a valid 6-digit PIN code"),
  years_in_business: z.string().trim().max(40).optional().or(z.literal("")),
  expected_monthly_purchase: z.string().trim().max(60).optional().or(z.literal("")),
  distribution_area: z.string().trim().max(200).optional().or(z.literal("")),
  warehouse_capacity: z.string().trim().max(60).optional().or(z.literal("")),
  sales_team_size: z.string().trim().max(40).optional().or(z.literal("")),
  existing_brands: z.string().trim().max(400).optional().or(z.literal("")),
});

/**
 * Submits (or re-submits after rejection) the signed-in user's application for
 * one partner role. The role is never granted here — only an admin approval
 * can do that.
 */
export const submitRoleApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => applicationInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId as string;
    const email = ((context.claims?.email as string | undefined) ?? "").toLowerCase();
    if (!email) throw new Error("Your session has no verified email address.");

    const { state } = await loadState(uid, email, data.role);
    if (state === "approved") return { ok: true, state, duplicate: true };
    if (state === "pending" || state === "under_review") return { ok: true, state, duplicate: true };

    const blank = (v?: string | null) => (v && v.trim() !== "" ? v.trim() : null);
    const { error } = await supabaseAdmin.from("partner_applications").insert({
      user_id: uid,
      partner_type: data.role as never,
      status: "pending",
      full_name: data.full_name,
      email,
      mobile: `+91${data.mobile}`,
      business_name: data.business_name,
      owner_name: blank(data.owner_name),
      business_type: blank(data.business_type),
      gstin: blank(data.gstin),
      pan: blank(data.pan),
      address: data.address,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      years_in_business: blank(data.years_in_business),
      expected_monthly_purchase: blank(data.expected_monthly_purchase),
      distribution_area: blank(data.distribution_area),
      warehouse_capacity: blank(data.warehouse_capacity),
      sales_team_size: blank(data.sales_team_size),
      existing_brands: blank(data.existing_brands),
    });
    if (error) throw new Error(error.message);

    // Keep the applicant's own contact details fresh, but never change their role.
    await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.full_name, phone: `+91${data.mobile}`, business_name: data.business_name })
      .eq("id", uid);

    try {
      const { notifyPartnerStatus } = await import("./notify.server");
      await notifyPartnerStatus({
        userId: uid,
        email,
        name: data.full_name,
        partnerType: data.role,
        status: "received",
        mobile: `+91${data.mobile}`,
      });
    } catch {
      /* notifications are never fatal */
    }

    return { ok: true, state: "pending" as PartnerState, duplicate: false };
  });
