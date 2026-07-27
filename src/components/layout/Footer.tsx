import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Facebook, Instagram, Youtube, Linkedin, Twitter, MessageCircle, MapPin, Mail, Phone } from "lucide-react";
import auronaLogo from "@/assets/aurona-logo-2026.png.asset.json";
import { siteSettingsQuery } from "@/lib/settings";

export function Footer() {
  const { data: s } = useQuery(siteSettingsQuery);
  const socials: [string, React.ComponentType<{ className?: string }>, string][] = [
    [s?.social_facebook ?? "#", Facebook, "Facebook"],
    [s?.social_instagram ?? "#", Instagram, "Instagram"],
    [s?.social_linkedin ?? "#", Linkedin, "LinkedIn"],
    [s?.social_youtube ?? "#", Youtube, "YouTube"],
    [s?.social_twitter ?? "#", Twitter, "Twitter / X"],
    [s?.social_whatsapp ?? "#", MessageCircle, "WhatsApp"],
  ];

  return (
    <footer className="relative mt-24 border-t border-primary/10 bg-gradient-to-b from-white via-surface/60 to-surface">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" aria-hidden />
      <div className="container-x grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-3">
            <img src={auronaLogo.url} alt="Aurona — Go Fearless in the Dark" className="h-12 w-auto object-contain mix-blend-multiply" />
          </div>
          <p className="mt-5 max-w-md text-[14px] leading-[1.75] text-muted-foreground">
            Aurona Lighting Industries manufactures premium LED lighting, fans and home appliances for
            modern India — trusted by 1000+ retailers and distributors nationwide since 2007.
          </p>
          <div className="mt-6 space-y-3 text-[13.5px] text-muted-foreground">
            <div className="flex items-start gap-3"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/8 text-primary"><MapPin className="h-3.5 w-3.5" /></span> <span className="pt-1">{s?.address_line ?? "Aurona Lighting Industries, Jaipur, Rajasthan, India"}</span></div>
            <div className="flex items-center gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/8 text-primary"><Phone className="h-3.5 w-3.5" /></span> <a href={`tel:${(s?.support_phone ?? "").replace(/\s/g,"")}`} className="transition-colors hover:text-primary">{s?.support_phone ?? "+91 96025 70026"}</a></div>
            <div className="flex items-center gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/8 text-primary"><Mail className="h-3.5 w-3.5" /></span> <a href={`mailto:${s?.support_email ?? ""}`} className="transition-colors hover:text-primary">{s?.support_email ?? "support@auronalighting.com"}</a></div>
          </div>
          <div className="mt-7 flex flex-wrap gap-2">
            {socials.map(([href, Icn, label]) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" className="group grid h-10 w-10 place-items-center rounded-full border border-primary/15 bg-white text-muted-foreground shadow-[0_1px_2px_rgba(10,132,209,0.05)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary hover:text-primary-foreground hover:shadow-[0_10px_22px_-10px_rgba(10,132,209,0.5)]" aria-label={label}>
                <Icn className="h-4 w-4 transition-transform group-hover:scale-110" />
              </a>
            ))}
          </div>
        </div>

        <Col title="Shop">
          <Link to="/products" className={cls}>All Products</Link>
          <Link to="/category/$slug" params={{ slug: "concealed-lights" }} className={cls}>Concealed Lights</Link>
          <Link to="/category/$slug" params={{ slug: "panel-lights" }} className={cls}>Panel Lights</Link>
          <Link to="/category/$slug" params={{ slug: "ceiling-fans" }} className={cls}>Ceiling Fans</Link>
          <Link to="/category/$slug" params={{ slug: "heaters" }} className={cls}>Heaters</Link>
        </Col>

        <Col title="Company">
          <Link to="/about" className={cls}>About Aurona</Link>
          <Link to="/leadership" className={cls}>Leadership Team</Link>
          <Link to="/company-information" className={cls}>Company Information</Link>
          <Link to="/partner" className={cls}>Partner With Us</Link>
          <Link to="/careers" className={cls}>Careers</Link>
          <Link to="/blogs" className={cls}>Blogs</Link>
          <Link to="/contact" className={cls}>Contact</Link>
        </Col>

        <Col title="Support">
          <Link to="/customer-service" className={cls}>Customer Service</Link>
          <Link to="/account" className={cls}>My Account</Link>
          <Link to="/account" className={cls}>Track Order</Link>
          <Link to="/policies/$slug" params={{ slug: "warranty" }} className={cls}>Warranty</Link>
          <Link to="/partner/$type" params={{ type: "retailer" }} className={cls}>Retailer Enquiry</Link>
          <Link to="/partner/$type" params={{ type: "distributor" }} className={cls}>Distributor Enquiry</Link>
        </Col>
      </div>

      <div className="border-t border-border">
        <div className="container-x flex flex-col items-center justify-between gap-2 py-5 text-xs text-muted-foreground sm:flex-row">
          <div>© {new Date().getFullYear()} Aurona Lighting Industries. All rights reserved.</div>
          <div className="flex gap-4">
            <Link to="/policies/$slug" params={{ slug: "privacy" }} className="hover:text-foreground">Privacy</Link>
            <Link to="/policies/$slug" params={{ slug: "terms" }} className="hover:text-foreground">Terms</Link>
            <Link to="/policies/$slug" params={{ slug: "shipping" }} className="hover:text-foreground">Shipping</Link>
            <Link to="/policies/$slug" params={{ slug: "return" }} className="hover:text-foreground">Returns</Link>
          </div>
        </div>
      </div>
      <div className="h-16 lg:hidden" />
    </footer>
  );
}

const cls = "text-muted-foreground transition-colors hover:text-primary hover:translate-x-0.5 inline-block duration-300";

function Col({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-eyebrow mb-4">{title}</div>
      <div className="flex flex-col gap-2 text-sm">{children}</div>
    </div>
  );
}
