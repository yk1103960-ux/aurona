// Server-only notification helper: sends transactional email and records every
// attempt in public.notification_log so admins have a delivery audit trail.
// SMS/WhatsApp delivery is intentionally logged as "skipped" unless a
// transactional MSG91 flow is configured (the OTP flow must not be reused).

type Channel = "email" | "sms" | "whatsapp";

export type NotifyKind =
  | "welcome"
  | "security_password_changed"
  | "security_email_changed"
  | "security_mobile_changed"
  | "partner_application_received"
  | "partner_application_under_review"
  | "partner_application_approved"
  | "partner_application_rejected"
  | "cart_abandoned"
  | "cart_abandoned_coupon";

const FROM = "Aurona <onboarding@resend.dev>";

function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  const head = user.slice(0, 2);
  return `${head}${"*".repeat(Math.max(1, user.length - 2))}@${domain}`;
}

function maskMobile(mobile: string): string {
  const d = mobile.replace(/\D/g, "");
  return `+91******${d.slice(-4)}`;
}

async function logNotification(params: {
  userId?: string | null;
  channel: Channel;
  kind: NotifyKind;
  recipientMasked: string;
  status: "sent" | "failed" | "skipped";
  providerMessage?: string | null;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("notification_log").insert({
      user_id: params.userId ?? null,
      channel: params.channel,
      kind: params.kind,
      recipient_masked: params.recipientMasked,
      status: params.status,
      provider_message: params.providerMessage ?? null,
    } as never);
  } catch {
    // Logging must never break the calling flow.
  }
}

/** Sends one transactional email through the Resend connector (no-op if unconfigured). */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  kind: NotifyKind;
  userId?: string | null;
}): Promise<boolean> {
  const resendKey = process.env["RESEND_API_KEY"];
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const masked = maskEmail(opts.to);

  if (!resendKey || !lovableKey) {
    await logNotification({
      userId: opts.userId,
      channel: "email",
      kind: opts.kind,
      recipientMasked: masked,
      status: "skipped",
      providerMessage: "Email provider not configured",
    });
    return false;
  }

  try {
    const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify({ from: FROM, to: [opts.to], subject: opts.subject, html: opts.html }),
    });
    const body = (await res.text()).slice(0, 200);
    await logNotification({
      userId: opts.userId,
      channel: "email",
      kind: opts.kind,
      recipientMasked: masked,
      status: res.ok ? "sent" : "failed",
      providerMessage: `HTTP ${res.status}`,
    });
    if (!res.ok) console.error(`[notify] email_failed kind=${opts.kind} http=${res.status} body=${body}`);
    return res.ok;
  } catch {
    await logNotification({
      userId: opts.userId,
      channel: "email",
      kind: opts.kind,
      recipientMasked: masked,
      status: "failed",
      providerMessage: "transport error",
    });
    return false;
  }
}

/**
 * Records an SMS/WhatsApp intent. A transactional (non-OTP) MSG91 flow id is
 * required to actually deliver these; until then the intent is logged so the
 * admin panel shows what would have been sent.
 */
export async function queueMobileNotification(opts: {
  mobile: string;
  kind: NotifyKind;
  userId?: string | null;
  channel?: Channel;
}): Promise<void> {
  await logNotification({
    userId: opts.userId,
    channel: opts.channel ?? "sms",
    kind: opts.kind,
    recipientMasked: maskMobile(opts.mobile),
    status: "skipped",
    providerMessage: "Transactional SMS template not configured",
  });
}

function shell(title: string, body: string): string {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
    <h2 style="margin:0 0 12px;font-size:20px">${title}</h2>
    ${body}
    <p style="margin-top:24px;font-size:12px;color:#777">Aurona Lighting Industries · Neem Ka Thana, Rajasthan</p>
  </div>`;
}

/** #5 — welcome message after a verified signup. */
export async function notifyWelcome(opts: {
  userId?: string | null;
  email: string;
  name?: string | null;
  mobile?: string | null;
}): Promise<void> {
  await sendEmail({
    to: opts.email,
    userId: opts.userId,
    kind: "welcome",
    subject: "Welcome to Aurona",
    html: shell(
      `Welcome${opts.name ? `, ${opts.name}` : ""}!`,
      `<p>Your Aurona account is verified and ready. You can now shop LED lighting, fans and appliances, track orders and manage addresses from your dashboard.</p>
       <p><a href="https://aurona.co.in/account" style="color:#0b5fff">Go to my account</a></p>`,
    ),
  });
  if (opts.mobile) {
    await queueMobileNotification({ mobile: opts.mobile, kind: "welcome", userId: opts.userId });
  }
}

/** #6 — security alert when password / email / mobile changes. */
export async function notifySecurityChange(opts: {
  userId?: string | null;
  email: string;
  change: "password" | "email" | "mobile";
  device?: string | null;
}): Promise<void> {
  const label =
    opts.change === "password" ? "password" : opts.change === "email" ? "email address" : "mobile number";
  const kind: NotifyKind =
    opts.change === "password"
      ? "security_password_changed"
      : opts.change === "email"
        ? "security_email_changed"
        : "security_mobile_changed";
  await sendEmail({
    to: opts.email,
    userId: opts.userId,
    kind,
    subject: `Your Aurona ${label} was changed`,
    html: shell(
      `Your ${label} was changed`,
      `<p>We're letting you know that the ${label} on your Aurona account was just updated${
        opts.device ? ` from <strong>${opts.device}</strong>` : ""
      }.</p>
       <p>If this wasn't you, reply to this email or contact <a href="mailto:auronalighting@gmail.com">auronalighting@gmail.com</a> immediately.</p>`,
    ),
  });
}

/** #7 — partner application lifecycle messages. */
export async function notifyPartnerStatus(opts: {
  userId?: string | null;
  email: string;
  name: string;
  partnerType: string;
  status: "received" | "under_review" | "approved" | "rejected";
  note?: string | null;
  mobile?: string | null;
}): Promise<void> {
  const copy: Record<string, { subject: string; title: string; body: string; kind: NotifyKind }> = {
    received: {
      subject: `We received your ${opts.partnerType} application — Aurona`,
      title: "Application received",
      body: `<p>Hi ${opts.name}, thanks for applying to the Aurona ${opts.partnerType} programme. Our team reviews applications within 3 business days.</p>`,
      kind: "partner_application_received",
    },
    under_review: {
      subject: `Your Aurona ${opts.partnerType} application is under review`,
      title: "Application under review",
      body: `<p>Hi ${opts.name}, your ${opts.partnerType} application is now being reviewed by our partnerships team. We may contact you for documents.</p>`,
      kind: "partner_application_under_review",
    },
    approved: {
      subject: `Approved — welcome to the Aurona ${opts.partnerType} programme`,
      title: "You're approved",
      body: `<p>Hi ${opts.name}, your ${opts.partnerType} account is approved. Sign in to see your partner pricing and place wholesale orders.</p>
             <p><a href="https://aurona.co.in/account" style="color:#0b5fff">Sign in to my account</a></p>`,
      kind: "partner_application_approved",
    },
    rejected: {
      subject: `Update on your Aurona ${opts.partnerType} application`,
      title: "Application update",
      body: `<p>Hi ${opts.name}, after review we're unable to approve your ${opts.partnerType} application at this time.</p>`,
      kind: "partner_application_rejected",
    },
  };
  const c = copy[opts.status]!;
  const note = opts.note ? `<p style="background:#f6f6f6;padding:12px;border-radius:8px"><strong>Note from our team:</strong> ${opts.note}</p>` : "";
  await sendEmail({
    to: opts.email,
    userId: opts.userId,
    kind: c.kind,
    subject: c.subject,
    html: shell(c.title, `${c.body}${note}`),
  });
  if (opts.mobile) {
    await queueMobileNotification({ mobile: opts.mobile, kind: c.kind, userId: opts.userId });
  }
}
