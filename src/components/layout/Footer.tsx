import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, Youtube, Linkedin, MapPin, Mail, Phone } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border bg-surface">
      <div className="container-x grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-primary text-primary-foreground">
              <span className="text-display text-lg font-semibold">A</span>
            </div>
            <div>
              <div className="text-display text-xl font-semibold">AURONA</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Innovating the way</div>
            </div>
          </div>
          <p className="mt-4 max-w-md text-sm text-muted-foreground">
            Aurona Lighting Industries manufactures premium LED lighting, fans and home appliances for
            modern India — trusted by 1000+ retailers and distributors nationwide since 2007.
          </p>
          <div className="mt-5 space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> Aurona Industries, PAN India</div>
            <div className="flex items-center gap-2"><Phone className="h-4 w-4" /> +91 99999 99999</div>
            <div className="flex items-center gap-2"><Mail className="h-4 w-4" /> care@aurona.in</div>
          </div>
          <div className="mt-5 flex gap-2">
            {[Facebook, Instagram, Youtube, Linkedin].map((Icn, i) => (
              <a key={i} href="#" className="grid h-9 w-9 place-items-center rounded-md border border-border hover:bg-background" aria-label="social">
                <Icn className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        <FooterCol title="Shop">
          <FLink to="/products">All Products</FLink>
          <FLink to="/category/$slug" params={{ slug: "concealed-lights" }}>Concealed Lights</FLink>
          <FLink to="/category/$slug" params={{ slug: "panel-lights" }}>Panel Lights</FLink>
          <FLink to="/category/$slug" params={{ slug: "ceiling-fans" }}>Ceiling Fans</FLink>
          <FLink to="/category/$slug" params={{ slug: "heaters" }}>Heaters</FLink>
        </FooterCol>

        <FooterCol title="Company">
          <FLink to="/about">About Aurona</FLink>
          <FLink to="/affiliate">Affiliate</FLink>
          <FLink to="/careers">Careers</FLink>
          <FLink to="/blogs">Blogs</FLink>
          <FLink to="/contact">Contact</FLink>
        </FooterCol>

        <FooterCol title="Support">
          <FLink to="/account">My Account</FLink>
          <FLink to="/account">Track Order</FLink>
          <FLink to="/contact">Warranty</FLink>
          <FLink to="/contact">Retailer Enquiry</FLink>
          <FLink to="/contact">Distributor Enquiry</FLink>
        </FooterCol>
      </div>

      <div className="border-t border-border">
        <div className="container-x flex flex-col items-center justify-between gap-2 py-5 text-xs text-muted-foreground sm:flex-row">
          <div>© {new Date().getFullYear()} Aurona Lighting Industries. All rights reserved.</div>
          <div className="flex gap-4">
            <a href="#">Privacy</a><a href="#">Terms</a><a href="#">Shipping</a><a href="#">Returns</a>
          </div>
        </div>
      </div>
      <div className="h-16 lg:hidden" />
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-eyebrow mb-4">{title}</div>
      <div className="flex flex-col gap-2 text-sm">{children}</div>
    </div>
  );
}

function FLink(props: React.ComponentProps<typeof Link>) {
  return <Link {...props} className="text-muted-foreground hover:text-foreground" />;
}
