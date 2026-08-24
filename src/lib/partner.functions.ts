import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const partnerTypes = [
  "retailer","distributor","sales","reseller","referral","affiliate",
  "corporate","government","architect","contractor","oem","builder","career",
] as const;

const PartnerInput = z.object({
  partner_type: z.enum(partnerTypes),
  full_name: z.string().trim().min(2).max(120),
  business_name: z.string().trim().max(160).optional().nullable(),
  owner_name: z.string().trim().max(160).optional().nullable(),
  mobile: z.string().trim().regex(/^[+\d\s\-()]{7,20}$/,"Invalid mobile"),
  email: z.string().trim().email().max(200),
  gstin: z.string().trim().max(20).optional().nullable(),
  pan: z.string().trim().max(20).optional().nullable(),
  cin: z.string().trim().max(30).optional().nullable(),
  address: z.string().trim().max(400).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  state: z.string().trim().max(80).optional().nullable(),
  pincode: z.string().trim().max(10).optional().nullable(),
  business_type: z.string().trim().max(80).optional().nullable(),
  years_in_business: z.string().trim().max(40).optional().nullable(),
  expected_monthly_purchase: z.string().trim().max(60).optional().nullable(),
  product_categories: z.array(z.string()).max(30).optional().nullable(),
  distribution_area: z.string().trim().max(200).optional().nullable(),
  warehouse_capacity: z.string().trim().max(60).optional().nullable(),
  sales_team_size: z.string().trim().max(40).optional().nullable(),
  existing_brands: z.string().trim().max(400).optional().nullable(),
  monthly_purchase_volume: z.string().trim().max(60).optional().nullable(),
  extra: z.record(z.string(), z.any()).optional().nullable(),
});

export const submitPartnerApplication = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => PartnerInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("partner_applications")
      .insert({ ...data, status: "pending" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    // #7 Logged applicant acknowledgement (also mirrors admin alert below).
    try {
      const { notifyPartnerStatus } = await import("./notify.server");
      await notifyPartnerStatus({
        email: data.email,
        name: data.full_name,
        partnerType: data.partner_type,
        status: "received",
        mobile: data.mobile,
      });
    } catch {
      /* notifications are never fatal */
    }
    // Email notification via Resend can be wired here once the connector is linked.
    // Reads process.env.RESEND_API_KEY inside this handler; no-op if missing.
    try {
      const resendKey = process.env.RESEND_API_KEY;
      const lovableKey = process.env.LOVABLE_API_KEY;
      if (resendKey && lovableKey) {
        const notifyTo = process.env.NOTIFICATION_EMAIL || "info@auronalighting.com";
        await fetch("https://connector-gateway.lovable.dev/resend/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": resendKey,
          },
          body: JSON.stringify({
            from: "Aurona <onboarding@resend.dev>",
            to: [notifyTo],
            subject: `New ${data.partner_type} application — ${data.full_name}`,
            html: renderApplicationEmail(data),
          }),
        }).catch(() => {});
        // acknowledgement to applicant
        await fetch("https://connector-gateway.lovable.dev/resend/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": resendKey,
          },
          body: JSON.stringify({
            from: "Aurona <onboarding@resend.dev>",
            to: [data.email],
            subject: "We received your application — Aurona",
            html: `<p>Hi ${data.full_name},</p><p>Thanks for applying to the Aurona ${data.partner_type} program. Our team will review your application and reach out within 3 business days.</p><p>— Team Aurona</p>`,
          }),
        }).catch(() => {});
      }
    } catch { /* email failures are non-fatal */ }
    return { id: row.id as string };
  });

function renderApplicationEmail(d: z.infer<typeof PartnerInput>): string {
  const rows = Object.entries(d)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `<tr><td style="padding:6px 12px;border:1px solid #eee;background:#fafafa;font-weight:600">${k}</td><td style="padding:6px 12px;border:1px solid #eee">${Array.isArray(v) ? v.join(", ") : String(v)}</td></tr>`)
    .join("");
  return `<h2>New ${d.partner_type} application</h2><table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px">${rows}</table>`;
}
