import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Facebook, Instagram, Youtube, Linkedin, Twitter, MapPin, Mail, Phone,
  ShieldCheck, Headphones, CreditCard, Truck, ArrowRight, Check,
} from "lucide-react";
import auronaLogo from "@/assets/aurona-logo-2026.png.asset.json";
import { siteSettingsQuery } from "@/lib/settings";

const FEATURES = [
  { icon: ShieldCheck, title: "Quality Products", sub: "ISO 9001:2015 certified products" },
  { icon: Headphones, title: "24/7 Support", sub: "Support available anytime" },
  { icon: CreditCard, title: "Online Payment", sub: "Secure online payments" },
  { icon: Truck, title: "Fast Delivery", sub: "Fast and reliable delivery" },
];

const COL_1: [string, string][] = [
  ["LED Bulbs", "led-bulbs"],
  ["Tube Lights", "tube-lights"],
  ["Concealed Lights", "concealed-lights"],
  ["Deep Lights", "deep-lights"],
  ["Panel Lights", "panel-lights"],
  ["Surface Panel Lights", "panel-lights"],
];

const COL_2: [string, string][] = [
  ["Street Lights", "street-lights"],
  ["Flood Lights", "flood-lights"],
  ["Interior Lights", "interior-lights"],
  ["Outdoor Lights", "outdoor-lights"],
  ["Decorative Lights", "decorative-lights"],
  ["All Lighting", ""],
];

const COL_3: [string, string][] = [
  ["Ceiling Fans", "ceiling-fans"],
  ["Pedestal Fans", "pedestal-fans"],
  ["Table Fans", "table-fans"],
  ["Room Heaters", "heaters"],
  ["Water Geysers", "water-geysers"],
  ["Exhaust Fans", "exhaust-fans"],
];

export function Footer() {
  const { data: s } = useQuery(siteSettingsQuery);
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const socials: [string, React.ComponentType<{ className?: string }>, string][] = [
    [s?.social_facebook ?? "#", Facebook, "Facebook"],
    [s?.social_twitter ?? "#", Twitter, "X (Twitter)"],
    [s?.social_instagram ?? "#", Instagram, "Instagram"],
    [s?.social_youtube ?? "#", Youtube, "YouTube"],
    [s?.social_linkedin ?? "#", Linkedin, "LinkedIn"],
  ];

  return (
    <footer className="relative mt-24">
      {/* Top feature strip */}
      <div className="bg-gradient-to-r from-primary via-[oklch(0.52_0.13_248)] to-primary text-primary-foreground">
        <div className="container-x grid grid-cols-2 gap-6 py-8 lg:grid-cols-4 lg:gap-8 lg:py-10">
          {FEATURES.map((f) => (
            <div key={f.title} className="group flex items-center gap-3.5 lg:justify-center">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-foreground/12 ring-1 ring-primary-foreground/20 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:bg-primary-foreground/20">
                <f.icon className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-bold tracking-[0.01em]">{f.title}</span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-primary-foreground/75">{f.sub}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Main footer */}
      <div className="border-t border-primary/10 bg-gradient-to-b from-white via-surface/60 to-surface">
        <div className="container-x grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-5 lg:gap-8">
          <FooterCol title="Lighting">
            {COL_1.map(([label, slug]) => <CatLink key={label} label={label} slug={slug} />)}
          </FooterCol>
          <FooterCol title="Lighting Range">
            {COL_2.map(([label, slug]) => <CatLink key={label} label={label} slug={slug} />)}
          </FooterCol>
          <FooterCol title="Appliances">
            {COL_3.map(([label, slug]) => <CatLink key={label} label={label} slug={slug} />)}
          </FooterCol>
          <FooterCol title="Useful Links">
            <Link to="/about" className={cls}>About Us</Link>
            <Link to="/products" className={cls}>Products</Link>
            <Link to="/careers" className={cls}>Career With Us</Link>
            <Link to="/contact" className={cls}>Contact Us</Link>
            <Link to="/company-information" className={cls}>Sitemap</Link>
            <Link to="/customer-service" className={cls}>FAQ</Link>
          </FooterCol>

          <div className="sm:col-span-2 lg:col-span-1">
            <FooterHeading>Contact Us</FooterHeading>
            <div className="mt-4 space-y-3 text-[13px] text-muted-foreground">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/8 text-primary"><MapPin className="h-3.5 w-3.5" /></span>
                <span className="pt-1">{s?.address_line ?? "Aurona Lighting Industries, Jaipur, Rajasthan, India"}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/8 text-primary"><Mail className="h-3.5 w-3.5" /></span>
                <a href={`mailto:${s?.support_email ?? ""}`} className="transition-colors hover:text-primary">{s?.support_email ?? "support@auronalighting.com"}</a>
              </div>
              <div className="flex items-center gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/8 text-primary"><Phone className="h-3.5 w-3.5" /></span>
                <a href={`tel:${(s?.support_phone ?? "").replace(/\s/g, "")}`} className="transition-colors hover:text-primary">{s?.support_phone ?? "+91 96025 70026"}</a>
              </div>
            </div>

            <form
              className="mt-6"
              onSubmit={(e) => { e.preventDefault(); if (email.trim()) setSubscribed(true); }}
            >
              <label htmlFor="footer-newsletter" className="block text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
                Newsletter
              </label>
              <div className="mt-2.5 flex gap-2">
                <input
                  id="footer-newsletter"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setSubscribed(false); }}
                  placeholder="Your email address"
                  className="h-11 min-w-0 flex-1 rounded-full border border-primary/15 bg-white px-4 text-[13px] text-foreground outline-none transition focus:border-primary/45 focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="submit"
                  className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-[oklch(0.52_0.13_248)] px-5 text-[11px] font-bold uppercase tracking-[0.16em] text-primary-foreground transition hover:brightness-110 active:scale-[0.97]"
                >
                  {subscribed ? <Check className="h-4 w-4" /> : <>Subscribe <ArrowRight className="h-3.5 w-3.5" /></>}
                </button>
              </div>
              {subscribed && <p className="mt-2 text-[12px] text-emerald-600">Thanks — you’re on the list.</p>}
            </form>
          </div>
        </div>

        {/* Brand + payments + socials */}
        <div className="border-t border-primary/10">
          <div className="container-x flex flex-col items-center justify-between gap-6 py-7 lg:flex-row">
            <img src={auronaLogo.url} alt="Aurona — Go Fearless in the Dark" className="h-11 w-auto object-contain mix-blend-multiply" />

            <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-6">
              <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">We Accept</span>
              <div className="flex items-center gap-2.5">
                {["UPI", "Paytm", "Mastercard", "VISA"].map((p) => (
                  <span
                    key={p}
                    className="grid h-9 min-w-[62px] place-items-center rounded-lg border border-primary/12 bg-white px-2.5 text-[11px] font-bold tracking-[0.06em] text-primary shadow-[0_1px_2px_rgba(10,132,209,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_10px_20px_-14px_rgba(10,132,209,0.55)]"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              {socials.map(([href, Icn, label]) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="group grid h-10 w-10 place-items-center rounded-full border border-primary/15 bg-white text-muted-foreground shadow-[0_1px_2px_rgba(10,132,209,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary hover:text-primary-foreground hover:shadow-[0_10px_22px_-10px_rgba(10,132,209,0.5)]"
                >
                  <Icn className="h-4 w-4 transition-transform group-hover:scale-110" />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border bg-white/60">
          <div className="container-x flex flex-col items-center justify-between gap-2 py-5 text-xs text-muted-foreground sm:flex-row">
            <div>Copyright © {new Date().getFullYear()}. All Rights Reserved | Aurona</div>
            <div className="flex gap-5">
              <Link to="/policies/$slug" params={{ slug: "privacy" }} className="transition-colors hover:text-primary">Privacy Policy</Link>
              <Link to="/policies/$slug" params={{ slug: "terms" }} className="transition-colors hover:text-primary">Terms &amp; Conditions</Link>
              <Link to="/policies/$slug" params={{ slug: "return" }} className="transition-colors hover:text-primary">Return Policy</Link>
            </div>
          </div>
        </div>
      </div>
      <div className="h-16 lg:hidden" />
    </footer>
  );
}

const cls = "text-muted-foreground transition-colors hover:text-primary hover:translate-x-0.5 inline-block duration-300";

function FooterHeading({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">{children}</div>
      <span className="mt-2 block h-[2px] w-10 rounded-full bg-gradient-to-r from-primary to-transparent" aria-hidden />
    </div>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <FooterHeading>{title}</FooterHeading>
      <div className="mt-4 flex flex-col gap-2.5 text-[13px]">{children}</div>
    </div>
  );
}

function CatLink({ label, slug }: { label: string; slug: string }) {
  if (!slug) return <Link to="/products" className={cls}>{label}</Link>;
  return (
    <Link to="/category/$slug" params={{ slug }} className={cls}>
      {label}
    </Link>
  );
}
