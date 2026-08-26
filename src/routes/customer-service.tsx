import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Phone, Mail, MessageCircle, Clock, MapPin, ArrowRight, LifeBuoy, ScrollText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { siteSettingsQuery } from "@/lib/settings";
import { submitSupportTicket } from "@/lib/support.functions";
import { validateEmail } from "@/lib/email-validation";
import { AURONA_FAQS as FAQS } from "@/components/marketing/FaqSection";

export const Route = createFileRoute("/customer-service")({
  loader: ({ context }) => context.queryClient.ensureQueryData(siteSettingsQuery),
  head: () => ({
    meta: [
      { title: "Customer Service — Aurona Lighting Industries" },
      { name: "description", content: "Contact Aurona support: call, WhatsApp, email, or raise a support ticket. Warranty, shipping, and return help." },
      { property: "og:title", content: "Customer Service — Aurona" },
      { property: "og:description", content: "Support ticketing, FAQs, and policies for Aurona Lighting Industries." },
    ],
  }),
  component: CustomerService,
});


const POLICIES = [
  { slug: "shipping", label: "Shipping Policy" },
  { slug: "return", label: "Return Policy" },
  { slug: "refund", label: "Refund Policy" },
  { slug: "warranty", label: "Warranty Policy" },
  { slug: "privacy", label: "Privacy Policy" },
  { slug: "terms", label: "Terms & Conditions" },
];

function CustomerService() {
  const s = useSuspenseQuery(siteSettingsQuery).data;
  const submit = useServerFn(submitSupportTicket);
  const [submitting, setSubmitting] = useState(false);
  const [ticket, setTicket] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const check = validateEmail(String(fd.get("email") ?? ""));
    if (!check.ok) {
      toast.error(check.reason ?? "Enter a valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await submit({
        data: {
          name: String(fd.get("name") ?? ""),
          email: String(fd.get("email") ?? ""),
          phone: String(fd.get("phone") ?? "") || null,
          subject: String(fd.get("subject") ?? ""),
          category: String(fd.get("category") ?? "") || null,
          message: String(fd.get("message") ?? ""),
        },
      });
      setTicket(res.ticket_number);
      toast.success("Ticket raised", { description: `Reference: ${res.ticket_number}` });
    } catch (err) {
      toast.error("Could not submit", { description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-x py-12">
      <div className="mx-auto max-w-3xl text-center">
        <div className="text-eyebrow text-gold">Customer Service</div>
        <h1 className="text-display mt-3 text-4xl md:text-5xl">We're here to help</h1>
        <p className="mt-4 text-base text-muted-foreground">Reach us by phone, WhatsApp, or email — or raise a support ticket and we'll get back within 24 hours.</p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ContactCard Icon={Phone} title="Call Support" value={s.support_phone} href={`tel:${s.support_phone.replace(/\s/g, "")}`} />
        <ContactCard Icon={MessageCircle} title="WhatsApp" value="Chat with us" href={s.social_whatsapp} />
        <ContactCard Icon={Mail} title="Email" value={s.support_email} href={`mailto:${s.support_email}`} />
        <ContactCard Icon={Clock} title="Hours" value={s.business_hours} />
      </div>

      <div className="mt-14 grid gap-10 lg:grid-cols-[1.15fr_1fr]">
        <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-6 sm:p-8">
          <div className="text-eyebrow text-gold">Raise a support ticket</div>
          <h2 className="text-display mt-2 text-2xl">Tell us how we can help</h2>

          {ticket ? (
            <div className="mt-6 rounded-lg border border-success bg-success/10 p-6 text-center">
              <ShieldCheck className="mx-auto h-10 w-10 text-success" />
              <div className="mt-2 text-lg font-semibold">Ticket created</div>
              <div className="mt-1 text-sm text-muted-foreground">Reference number</div>
              <div className="mt-1 font-mono text-lg">{ticket}</div>
              <p className="mt-3 text-xs text-muted-foreground">Save this number to track your ticket. Our team will respond via email.</p>
              <Button variant="outline" className="mt-4" onClick={() => setTicket(null)}>Raise another</Button>
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field name="name" label="Name *" required />
                <Field name="email" label="Email *" type="email" required />
                <Field name="phone" label="Phone" type="tel" />
                <div>
                  <Label htmlFor="category" className="text-xs">Category</Label>
                  <select id="category" name="category" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Select</option>
                    <option>Order status</option>
                    <option>Shipping / delivery</option>
                    <option>Return / refund</option>
                    <option>Warranty claim</option>
                    <option>Product enquiry</option>
                    <option>Retailer / distributor</option>
                    <option>Other</option>
                  </select>
                </div>
                <Field name="subject" label="Subject *" required className="sm:col-span-2" />
                <div className="sm:col-span-2">
                  <Label htmlFor="message" className="text-xs">Message *</Label>
                  <Textarea id="message" name="message" rows={5} required className="mt-1" />
                </div>
              </div>
              <Button type="submit" size="lg" className="mt-6 w-full h-12 rounded-none" disabled={submitting}>
                {submitting ? "Sending…" : "Submit ticket"}
              </Button>
            </>
          )}
        </form>

        <div className="space-y-8">
          <div>
            <div className="text-eyebrow">FAQs</div>
            <div className="mt-4 space-y-4">
              {FAQS.map((f) => (
                <details key={f.q} className="group rounded-lg border border-border p-4 open:bg-surface">
                  <summary className="cursor-pointer list-none text-sm font-semibold">{f.q}</summary>
                  <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </div>

          <div>
            <div className="text-eyebrow">Policies</div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {POLICIES.map((p) => (
                <Link
                  key={p.slug}
                  to="/policies/$slug"
                  params={{ slug: p.slug }}
                  className="group flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm hover:border-gold/40"
                >
                  <span className="flex items-center gap-2"><ScrollText className="h-4 w-4 text-gold" />{p.label}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 text-gold" />
              <div className="text-sm">
                <div className="font-semibold">Head Office</div>
                <div className="mt-1 text-muted-foreground">{s.address_line}</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3"><LifeBuoy className="h-5 w-5 text-gold" /><div className="text-sm font-semibold">Existing ticket?</div></div>
            <p className="mt-2 text-sm text-muted-foreground">Sign in to your account to track your open tickets and order status.</p>
            <Button asChild variant="outline" className="mt-4 w-full"><Link to="/account">Go to my account</Link></Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactCard({ Icon, title, value, href }: { Icon: React.ComponentType<{ className?: string }>; title: string; value: string; href?: string }) {
  const body = (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card p-5 transition hover:border-gold/40">
      <Icon className="h-5 w-5 text-gold" />
      <div className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
  return href ? <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">{body}</a> : body;
}

function Field({ name, label, type = "text", required, className }: { name: string; label: string; type?: string; required?: boolean; className?: string }) {
  return (
    <div className={className}>
      <Label htmlFor={name} className="text-xs">{label}</Label>
      <Input id={name} name={name} type={type} required={required} className="mt-1" />
    </div>
  );
}
