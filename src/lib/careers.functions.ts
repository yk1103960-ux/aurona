import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const applicationSchema = z.object({
  program_id: z.string().uuid().nullable().optional(),
  program_title: z.string().trim().min(2).max(160),
  full_name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  city: z.string().trim().max(80).optional().nullable(),
  state: z.string().trim().max(80).optional().nullable(),
  qualification: z.string().trim().max(160).optional().nullable(),
  experience: z.string().trim().max(160).optional().nullable(),
  message: z.string().trim().max(2000).optional().nullable(),
  resume_url: z.string().trim().url().max(500).optional().nullable().or(z.literal("")),
  consent: z.literal(true),
  resume_file: z
    .object({
      name: z.string().max(200),
      type: z.string().max(120),
      // base64 payload, ~3 MB decoded ceiling enforced below
      data: z.string().max(4_500_000),
    })
    .optional()
    .nullable(),
});

function clean(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return v.length ? v : null;
}

/**
 * Public career/partner-program application intake.
 *
 * The resume is stored in the private `media` bucket (admins read it through a
 * signed URL), and an admin notification is queued in `notification_queue`.
 * Nothing is sent yet — an email provider gets attached to the queue later
 * without touching this intake logic.
 */
export const submitCareerApplication = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => applicationSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let resumePath: string | null = null;
    if (data.resume_file?.data) {
      const bytes = Uint8Array.from(atob(data.resume_file.data), (c) => c.charCodeAt(0));
      if (bytes.byteLength > 3 * 1024 * 1024) throw new Error("Resume must be 3 MB or smaller");
      const safeName = data.resume_file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
      const path = `careers/${crypto.randomUUID()}-${safeName}`;
      const up = await supabaseAdmin.storage.from("media").upload(path, bytes, {
        contentType: data.resume_file.type || "application/octet-stream",
        upsert: false,
      });
      if (!up.error) resumePath = path;
    }

    const { data: row, error } = await supabaseAdmin
      .from("career_applications")
      .insert({
        program_id: data.program_id ?? null,
        program_title: data.program_title,
        full_name: data.full_name,
        email: data.email,
        phone: `+91${data.phone}`,
        city: clean(data.city),
        state: clean(data.state),
        qualification: clean(data.qualification),
        experience: clean(data.experience),
        message: clean(data.message),
        resume_url: clean(data.resume_url),
        resume_path: resumePath,
        consent_at: new Date().toISOString(),
        status: "new",
      } as never)
      .select("id")
      .single();
    if (error) throw new Error("Could not save your application. Please try again.");

    const { data: setting } = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", "career_admin_email")
      .maybeSingle();

    await supabaseAdmin.from("notification_queue").insert({
      channel: "email",
      template: "career_application_admin",
      recipient: setting?.value || "careers@aurona.co.in",
      subject: `New application — ${data.program_title}`,
      body: [
        `Program: ${data.program_title}`,
        `Name: ${data.full_name}`,
        `Email: ${data.email}`,
        `Mobile: +91${data.phone}`,
        `City/State: ${clean(data.city) ?? "—"} / ${clean(data.state) ?? "—"}`,
        `Qualification: ${clean(data.qualification) ?? "—"}`,
        `Experience: ${clean(data.experience) ?? "—"}`,
        `Resume: ${resumePath ? "file attached in admin" : (clean(data.resume_url) ?? "—")}`,
        "",
        clean(data.message) ?? "",
      ].join("\n"),
      payload: { application_id: row?.id ?? null } as never,
      related_type: "career_application",
      related_id: row?.id ?? null,
      status: "queued",
    } as never);

    return { ok: true, id: row?.id ?? null };
  });

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

export const adminListCareerApplications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ search: z.string().max(120).optional(), status: z.string().max(30).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("career_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const term = (data.search ?? "").trim().toLowerCase();
    const list = (rows ?? []).filter(
      (r: any) =>
        !term ||
        [r.full_name, r.email, r.phone, r.program_title, r.city].some((v: string | null) =>
          (v ?? "").toLowerCase().includes(term),
        ),
    );
    // Signed download links for uploaded resumes (private bucket).
    return Promise.all(
      list.map(async (r: any) => {
        let resume_download: string | null = null;
        if (r.resume_path) {
          const signed = await supabaseAdmin.storage.from("media").createSignedUrl(r.resume_path, 60 * 30);
          resume_download = signed.data?.signedUrl ?? null;
        }
        return { ...r, resume_download };
      }),
    );
  });

export const adminUpdateCareerApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["new", "reviewing", "shortlisted", "rejected", "hired"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("career_applications")
      .update({ status: data.status } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: context.userId,
      action: "career_application.status",
      entity_type: "career_application",
      entity_id: data.id,
      after: { status: data.status } as never,
    } as never);
    return { ok: true };
  });

export const adminListNotificationQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ channel: z.string().max(20).optional(), limit: z.number().min(1).max(200).default(100) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("notification_queue")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.channel) q = q.eq("channel", data.channel);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
