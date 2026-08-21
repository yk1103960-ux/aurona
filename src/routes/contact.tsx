import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Mail, MapPin, MessageCircle, Clock, Facebook, Instagram, Youtube, Linkedin, Twitter } from "lucide-react";
import { toast } from "sonner";
import { siteSettingsQuery } from "@/lib/settings";

const OFFICE_ADDRESS =
  "Aurona Lighting Industries, Behind Shyam Mandir, Talab Road, Ward No-6, Neem Ka Thana, Rajasthan, PIN-332706, India";
const SECOND_EMAIL = "auronalighting@gmail.com";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Aurona — Customer & Partner Support" },
      {
        name: "description",
        content:
          "Call, WhatsApp or email Aurona Lighting Industries, Neem Ka Thana, Rajasthan for product, order, warranty and partner support.",
      },
      { property: "og:title", content: "Contact Aurona Lighting Industries" },
      { property: "og:description", content: "Phone, WhatsApp, email and office address for Aurona customer and partner support." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Contact,
});

function Contact() {
  const { data: s } = useQuery(siteSettingsQuery);
  const [busy, setBusy] = useState(false);

  const phone = s?.support_phone ?? "";
  const whatsappUrl = s?.social_whatsapp ?? "";
  const whatsappLabel = s?.notification_mobile || phone;

  const socials = [
    { Icon: Facebook, label: "Facebook", href: s?.social_facebook },
    { Icon: Instagram, label: "Instagram", href: s?.social_instagram },
    { Icon: Youtube, label: "YouTube", href: s?.social_youtube },
    { Icon: Linkedin, label: "LinkedIn", href: s?.social_linkedin },
    { Icon: Twitter, label: "X (Twitter)", href: s?.social_twitter },
  ].filter((x) => !!x.href);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      toast.success("Thanks — we'll reach out shortly.");
      form.reset();
    }, 700);
  };

  return (
    <div className="container-x py-16">
      <div className="text-eyebrow">Support</div>
      <h1 className="text-display mt-3 text-5xl">Talk to Aurona.</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Product enquiries, order support, warranty, and retailer/distributor questions.
      </p>

      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <Info Icon={Phone} label="Phone" v={phone} href={`tel:${phone.replace(/\s/g, "")}`} />
          <Info Icon={MessageCircle} label="WhatsApp" v={whatsappLabel} href={whatsappUrl} />
          <Info Icon={Mail} label="Email" v={s?.support_email ?? ""} href={`mailto:${s?.support_email ?? ""}`} />
          <Info Icon={Mail} label="Alternate email" v={SECOND_EMAIL} href={`mailto:${SECOND_EMAIL}`} />
          <Info Icon={MapPin} label="Office" v={OFFICE_ADDRESS} />
          <Info Icon={Clock} label="Business hours" v={s?.business_hours ?? ""} />

          <div className="rounded-xl border border-border p-4">
            <div className="text-eyebrow">Follow Aurona</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {socials.map((sn) => (
                <a
                  key={sn.label}
                  href={sn.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={sn.label}
                  title={sn.label}
                  className="grid h-10 w-10 place-items-center rounded-full border border-border bg-surface text-muted-foreground transition hover:border-primary hover:text-primary"
                >
                  <sn.Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <F l="Full name" />
            <F l="Phone" />
            <F l="Email" type="email" full />
            <div className="sm:col-span-2">
              <Label className="text-xs">Category</Label>
              <select className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm" required>
                <option>Product enquiry</option>
                <option>Order support</option>
                <option>Warranty</option>
                <option>Retailer enquiry</option>
                <option>Distributor enquiry</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Message</Label>
              <Textarea rows={5} required className="mt-1" />
            </div>
          </div>
          <Button className="mt-6 h-11 w-full rounded-full" disabled={busy}>
            {busy ? "Sending…" : "Send message"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function F({ l, type = "text", full }: { l: string; type?: string; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <Label className="text-xs">{l}</Label>
      <Input required type={type} className="mt-1 h-11" />
    </div>
  );
}

function Info({
  Icon,
  label,
  v,
  href,
}: {
  Icon: typeof Phone;
  label: string;
  v: string;
  href?: string;
}) {
  const value = href ? (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="hover:text-primary">
      {v}
    </a>
  ) : (
    v
  );
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border p-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface">
        <Icon className="h-4 w-4 text-gold" />
      </div>
      <div>
        <div className="text-eyebrow">{label}</div>
        <div className="mt-0.5 text-sm font-semibold leading-relaxed">{value}</div>
      </div>
    </div>
  );
}
