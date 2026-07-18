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

        <Col title="Shop">
          <Link to="/products" className={cls}>All Products</Link>
          <Link to="/category/$slug" params={{ slug: "concealed-lights" }} className={cls}>Concealed Lights</Link>
          <Link to="/category/$slug" params={{ slug: "panel-lights" }} className={cls}>Panel Lights</Link>
          <Link to="/category/$slug" params={{ slug: "ceiling-fans" }} className={cls}>Ceiling Fans</Link>
          <Link to="/category/$slug" params={{ slug: "heaters" }} className={cls}>Heaters</Link>
        </Col>

        <Col title="Company">
          <Link to="/about" className={cls}>About Aurona</Link>
          <Link to="/affiliate" className={cls}>Affiliate</Link>
          <Link to="/careers" className={cls}>Careers</Link>
          <Link to="/blogs" className={cls}>Blogs</Link>
          <Link to="/contact" className={cls}>Contact</Link>
        </Col>

        <Col title="Support">
          <Link to="/account" className={cls}>My Account</Link>
          <Link to="/account" className={cls}>Track Order</Link>
          <Link to="/contact" className={cls}>Warranty</Link>
          <Link to="/contact" className={cls}>Retailer Enquiry</Link>
          <Link to="/contact" className={cls}>Distributor Enquiry</Link>
        </Col>
      </div>

      <div className="border-t border-border">
        <div className="container-x flex flex-col items-center justify-between gap-2 py-5 text-xs text-muted-foreground sm:flex-row">
          <div>© {new Date().getFullYear()} Aurona Lighting Industries. All rights reserved.</div>
          <div className="flex gap-4"><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Shipping</a><a href="#">Returns</a></div>
        </div>
      </div>
      <div className="h-16 lg:hidden" />
    </footer>
  );
}

const cls = "text-muted-foreground hover:text-foreground";

function Col({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-eyebrow mb-4">{title}</div>
      <div className="flex flex-col gap-2 text-sm">{children}</div>
    </div>
  );
}
