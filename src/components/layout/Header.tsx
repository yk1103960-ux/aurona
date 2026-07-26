import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu, Search, Heart, ShoppingCart, User, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { categoriesQuery, type Category } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useScrolled } from "@/hooks/useScrolled";
import auronaLogo from "@/assets/aurona-logo-2026.png.asset.json";

// Mega menu column layout (based on client's reference)
const LED_COLUMNS: { title: string; slug: string }[][] = [
  [
    { title: "LED Bulbs", slug: "led-bulbs" },
    { title: "Surface Panel", slug: "surface-panel" },
  ],
  [
    { title: "Street Lights", slug: "street-lights" },
    { title: "Panel Lights", slug: "panel-lights" },
  ],
  [
    { title: "Interior Lights", slug: "interior-lights" },
    { title: "Deep Lights", slug: "deep-lights" },
  ],
  [
    { title: "Flood Lights", slug: "flood-lights" },
    { title: "Decorative Lights", slug: "decorative-lights" },
  ],
  [
    { title: "Tubelight", slug: "tube-lights" },
    { title: "Outdoor Lights", slug: "outdoor-lights" },
    { title: "Concealed Lights", slug: "concealed-lights" },
  ],
];

export function Header() {
  const navigate = useNavigate();
  const cart = useCart();
  const wl = useWishlist();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [openMobile, setOpenMobile] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const scrolled = useScrolled(12);
  const { data: cats = [] } = useQuery(categoriesQuery);

  useEffect(() => setOpenMobile(false), [pathname]);
  useEffect(() => setMegaOpen(false), [pathname]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    navigate({ to: "/products", search: { q: q.trim() } as never });
  };

  const catBySlug = (slug: string) => cats.find((c) => c.slug === slug);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-[background-color,backdrop-filter,border-color,box-shadow,height] duration-500",
        "border-b bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/75",
        scrolled
          ? "border-primary/10 shadow-[0_8px_28px_-16px_oklch(0.55_0.14_240/0.35)]"
          : "border-primary/8 shadow-[0_1px_0_0_oklch(0.55_0.14_240/0.06)]",
      )}
      onMouseLeave={() => setMegaOpen(false)}
    >
      {/* Main bar */}
      <div
        className={cn(
          "container-x flex items-center justify-between text-foreground transition-[height] duration-500 lg:grid lg:grid-cols-[auto_1fr_auto] lg:gap-8",
          scrolled ? "h-[60px] lg:h-[72px]" : "h-[66px] lg:h-[84px]",
        )}
      >
        {/* Left: hamburger (mobile) + logo cluster */}
        <div className="flex min-w-0 flex-1 items-center gap-2 lg:flex-none lg:gap-3">
          <Sheet open={openMobile} onOpenChange={setOpenMobile}>
            <SheetTrigger asChild>
              <button
                className="press -ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-primary transition-colors hover:bg-primary/8 lg:hidden"
                aria-label="Menu"
              >
                <Menu className="h-6 w-6" strokeWidth={1.75} />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[86vw] max-w-sm border-border bg-background p-0 text-foreground">
              <MobileMenu onClose={() => setOpenMobile(false)} cats={cats} />
            </SheetContent>
          </Sheet>
          <Link
            to="/"
            className="flex min-w-0 flex-1 items-center justify-center lg:flex-none lg:justify-start"
            aria-label="Aurona — Go Fearless in the Dark"
          >
            <img
              src={auronaLogo.url}
              alt="Aurona — Go Fearless in the Dark"
              className={cn(
                "w-auto max-w-[180px] shrink-0 object-contain mix-blend-multiply transition-[height] duration-500 sm:max-w-none",
                scrolled ? "h-9 lg:h-9" : "h-11 lg:h-11",
              )}
            />
          </Link>
        </div>

        {/* Center: primary nav */}
        <nav className="hidden items-center justify-center gap-0.5 lg:flex">
          <NavItem to="/">Home</NavItem>
          <NavItem to="/products">All Products</NavItem>
          <NavItem to="/products">Home Appliances</NavItem>

          {/* LED Lightings mega trigger */}
          <div
            className="relative"
            onMouseEnter={() => setMegaOpen(true)}
          >
            <button
              type="button"
              onClick={() => setMegaOpen((v) => !v)}
              className={cn(
                "group relative inline-flex items-center gap-1 px-3.5 py-2 text-[11.5px] font-semibold uppercase tracking-[0.22em] transition-colors",
                megaOpen ? "text-primary" : "text-foreground/72 hover:text-primary",
              )}
              aria-expanded={megaOpen}
              aria-haspopup="true"
            >
              <span className="relative">
                LED Lightings
                <span className={cn(
                  "pointer-events-none absolute -bottom-1 left-1/2 h-[2px] -translate-x-1/2 rounded-full bg-primary transition-all duration-300",
                  megaOpen ? "w-full" : "w-0 group-hover:w-full",
                )} />
              </span>
              <ChevronDown className={cn("h-3 w-3 transition-transform", megaOpen && "rotate-180")} />
            </button>
          </div>

          <NavItem to="/affiliate">Affiliate With Us</NavItem>
          <NavItem to="/careers">Career With Us</NavItem>
          <NavItem to="/blogs">Blogs</NavItem>
          <NavItem to="/about">About Us</NavItem>
          <NavItem to="/contact">Contact Us</NavItem>
        </nav>

        {/* Right: actions */}
        <div className="flex shrink-0 items-center justify-end gap-0.5 sm:gap-1">
          <button
            onClick={() => document.getElementById("aurona-search-input")?.focus()}
            className="hidden h-11 w-11 place-items-center rounded-full text-primary transition-all hover:bg-primary/8 hover:scale-105 sm:grid"
            aria-label="Search"
          >
            <Search className="h-[19px] w-[19px]" strokeWidth={1.75} />
          </button>
          <Link
            to="/wishlist"
            className="relative hidden h-11 w-11 place-items-center rounded-full text-primary transition-all hover:bg-primary/8 hover:scale-105 sm:grid"
            aria-label="Wishlist"
          >
            <Heart className="h-[19px] w-[19px]" strokeWidth={1.75} />
            {wl.count > 0 && <Badge count={wl.count} />}
          </Link>
          <Link
            to={user ? "/account" : "/auth"}
            className="hidden h-11 w-11 place-items-center rounded-full text-primary transition-all hover:bg-primary/8 hover:scale-105 sm:grid"
            aria-label="Account"
          >
            <User className="h-[19px] w-[19px]" strokeWidth={1.75} />
          </Link>
          <Link
            to="/cart"
            className="press relative -mr-2 grid h-10 w-10 place-items-center rounded-full text-primary transition-all hover:bg-primary/8 hover:scale-105 lg:mr-0 lg:h-11 lg:w-11"
            aria-label="Cart"
          >
            <ShoppingCart className="h-6 w-6 lg:h-[19px] lg:w-[19px]" strokeWidth={1.75} />
            {cart.count > 0 && <Badge count={cart.count} />}
          </Link>
        </div>
      </div>

      {/* LED Lightings Mega Menu — desktop */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-full hidden origin-top overflow-hidden border-b border-primary/10 bg-white/98 shadow-[0_24px_50px_-24px_rgba(15,23,42,0.25)] backdrop-blur-xl transition-all duration-300 lg:block",
          megaOpen ? "pointer-events-auto opacity-100 translate-y-0" : "opacity-0 -translate-y-3",
        )}
        onMouseEnter={() => setMegaOpen(true)}
        onMouseLeave={() => setMegaOpen(false)}
      >
        <div className="container-x grid grid-cols-6 gap-6 py-8">
          {LED_COLUMNS.map((col, ci) => (
            <div key={ci} className="min-w-0">
              {col.map((item) => {
                const c = catBySlug(item.slug);
                return (
                  <div key={item.slug} className="mb-5 last:mb-0">
                    <Link
                      to="/category/$slug"
                      params={{ slug: item.slug }}
                      className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary transition hover:text-gold"
                    >
                      {item.title}
                    </Link>
                    <div className="mt-2 space-y-1.5">
                      {c ? (
                        <Link
                          to="/category/$slug"
                          params={{ slug: c.slug }}
                          className="block text-[13px] text-foreground/75 transition hover:text-primary"
                        >
                          Shop all →
                        </Link>
                      ) : (
                        <span className="block text-[12px] text-muted-foreground italic">Coming soon</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div className="col-span-1 rounded-xl border border-primary/15 bg-gradient-to-br from-primary/8 via-white to-gold/10 p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold">Featured</div>
            <div className="mt-2 text-display text-lg leading-tight text-primary">Winter Collection</div>
            <p className="mt-2 text-[12px] text-muted-foreground">Ambient panels &amp; concealed lighting for warm interiors.</p>
            <Link to="/featured" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-primary hover:text-gold">
              Explore →
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile inline search — appears once scrolled */}
      {scrolled && (
        <div className="border-t border-primary/8 bg-white/60 px-3 py-2 backdrop-blur-xl lg:hidden">
          <form onSubmit={submit}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
              <Input
                id="aurona-search-input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search premium lighting…"
                className="h-11 rounded-full border-primary/15 bg-white pl-11 pr-16 text-[13px] font-medium text-foreground placeholder:font-normal placeholder:text-muted-foreground focus-visible:border-primary/40 focus-visible:ring-primary/25"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 grid h-8 -translate-y-1/2 place-items-center rounded-full bg-primary px-4 text-[10px] font-bold uppercase tracking-[0.18em] text-primary-foreground shadow-sm transition hover:brightness-110 active:scale-[0.97]"
              >
                Go
              </button>
            </div>
          </form>
        </div>
      )}
    </header>
  );
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to as never}
      className="group relative px-3 py-2 text-[11.5px] font-semibold uppercase tracking-[0.22em] text-foreground/72 transition-colors hover:text-primary"
      activeProps={{ className: "text-primary" }}
    >
      <span className="relative">
        {children}
        <span className="pointer-events-none absolute -bottom-1 left-1/2 h-[2px] w-0 -translate-x-1/2 rounded-full bg-primary transition-all duration-300 group-hover:w-full" />
      </span>
    </Link>
  );
}

function Badge({ count }: { count: number }) {
  const prev = useRef(count);
  const [pop, setPop] = useState(false);
  useEffect(() => {
    if (count !== prev.current && count > 0) {
      setPop(true);
      const t = window.setTimeout(() => setPop(false), 420);
      return () => window.clearTimeout(t);
    }
    prev.current = count;
  }, [count]);
  return (
    <span
      key={count}
      className={cn(
        "absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-white",
        pop && "badge-pop",
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function MobileMenu({ onClose, cats }: { onClose: () => void; cats: Category[] }) {
  const groups = ["led-lighting", "fans", "home-appliances"] as const;
  const groupLabel: Record<string, string> = {
    "led-lighting": "LED Lightings",
    fans: "Fans",
    "home-appliances": "Home Appliances",
  };
  const { user } = useAuth();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border p-4">
        <img src={auronaLogo.url} alt="Aurona" className="h-9 w-auto object-contain mix-blend-multiply" />
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <MobileLink to="/" onClose={onClose}>Home</MobileLink>
        <MobileLink to="/products" onClose={onClose}>All Products</MobileLink>
        {groups.map((g) => (
          <details key={g} className="group border-t border-border">
            <summary className="flex cursor-pointer items-center justify-between px-3 py-3 text-sm font-semibold">
              {groupLabel[g]}
              <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
            </summary>
            <div className="pb-2">
              {cats.filter((c) => c.parent_group === g).map((c) => (
                <Link
                  key={c.id}
                  to="/category/$slug"
                  params={{ slug: c.slug }}
                  onClick={onClose}
                  className="block px-6 py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </details>
        ))}
        <div className="mt-2 border-t border-border">
          <MobileLink to="/affiliate" onClose={onClose}>Affiliate With Us</MobileLink>
          <MobileLink to="/careers" onClose={onClose}>Career With Us</MobileLink>
          <MobileLink to="/blogs" onClose={onClose}>Blogs</MobileLink>
          <MobileLink to="/about" onClose={onClose}>About Us</MobileLink>
          <MobileLink to="/contact" onClose={onClose}>Contact Us</MobileLink>
          <MobileLink to={user ? "/account" : "/auth"} onClose={onClose}>{user ? "My Account" : "Sign In / Register"}</MobileLink>
        </div>
      </div>
    </div>
  );
}

function MobileLink({ to, children, onClose }: { to: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <Link to={to as never} onClick={onClose} className="block border-t border-border px-3 py-3 text-sm font-semibold">
      {children}
    </Link>
  );
}
