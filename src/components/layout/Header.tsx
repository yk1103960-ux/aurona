import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu, Search, Heart, ShoppingCart, User, X, ChevronDown, Phone, Truck, ShieldCheck, Factory } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { categoriesQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useScrolled } from "@/hooks/useScrolled";
import auronaLogo from "@/assets/aurona-logo.png.asset.json";

const NAV = [
  { label: "Home", to: "/" },
  { label: "All Products", to: "/products" },
  { label: "LED Lighting", to: "/products", group: "led-lighting" },
  { label: "Fans", to: "/products", group: "fans" },
  { label: "Home Appliances", to: "/products", group: "home-appliances" },
  { label: "About", to: "/about" },
  { label: "Blogs", to: "/blogs" },
];

export function Header() {
  const navigate = useNavigate();
  const cart = useCart();
  const wl = useWishlist();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [openMobile, setOpenMobile] = useState(false);
  const { data: cats = [] } = useQuery(categoriesQuery);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => setOpenMobile(false), [pathname]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    navigate({ to: "/products", search: { q: q.trim() } as never });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      {/* Utility bar (desktop) */}
      <div className="hidden border-b border-border bg-surface text-xs text-muted-foreground lg:block">
        <div className="container-x flex h-9 items-center justify-between">
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> PAN India Delivery</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Genuine Products</span>
            <span className="flex items-center gap-1.5"><Factory className="h-3.5 w-3.5" /> Manufacturer Direct</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="tel:+919999999999" className="flex items-center gap-1.5 hover:text-foreground"><Phone className="h-3.5 w-3.5" /> +91 99999 99999</a>
            <Link to="/account" className="hover:text-foreground">Track Order</Link>
          </div>
        </div>
      </div>

      {/* Main bar */}
      <div className="container-x grid h-16 grid-cols-[auto_1fr_auto] items-center gap-3 lg:h-20 lg:gap-6">
        {/* Left: hamburger + logo */}
        <div className="flex items-center gap-2">
          <Sheet open={openMobile} onOpenChange={setOpenMobile}>
            <SheetTrigger asChild>
              <button className="grid h-10 w-10 place-items-center rounded-md lg:hidden" aria-label="Menu">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[86vw] max-w-sm p-0">
              <MobileMenu onClose={() => setOpenMobile(false)} />
            </SheetContent>
          </Sheet>
          <Link to="/" className="flex items-center gap-2">
            <img src={auronaLogo.url} alt="Aurona" className="h-10 w-10 object-contain lg:h-12 lg:w-12" />
            <div className="leading-tight">
              <div className="text-display text-xl font-semibold tracking-tight text-primary">AURONA</div>
              <div className="hidden text-[10px] uppercase tracking-[0.22em] text-muted-foreground sm:block">Innovating the way</div>
            </div>
          </Link>
        </div>

        {/* Center: search (desktop) */}
        <form onSubmit={submit} className="hidden lg:block">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products, categories, models and more"
              className="h-11 rounded-full border-border-strong bg-surface pl-10 pr-24 text-sm"
            />
            <Button type="submit" size="sm" className="absolute right-1.5 top-1/2 h-8 -translate-y-1/2 rounded-full px-4">Search</Button>
          </div>
        </form>

        {/* Right: actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate({ to: "/products", search: { q: "" } as never })}
            className="grid h-10 w-10 place-items-center rounded-md lg:hidden"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>
          <Link to="/wishlist" className="relative hidden h-10 w-10 place-items-center rounded-md sm:grid" aria-label="Wishlist">
            <Heart className="h-5 w-5" />
            {wl.count > 0 && <Badge count={wl.count} />}
          </Link>
          <Link to={user ? "/account" : "/auth"} className="hidden h-10 w-10 place-items-center rounded-md sm:grid" aria-label="Account">
            <User className="h-5 w-5" />
          </Link>
          <Link to="/cart" className="relative grid h-10 w-10 place-items-center rounded-md" aria-label="Cart">
            <ShoppingCart className="h-5 w-5" />
            {cart.count > 0 && <Badge count={cart.count} />}
          </Link>
        </div>
      </div>

      {/* Desktop nav */}
      <nav className="hidden border-t border-border bg-background lg:block">
        <div className="container-x flex h-11 items-center gap-1">
          {NAV.map((n) => (
            <Link
              key={n.label}
              to={n.to}
              search={n.group ? ({ group: n.group } as never) : undefined}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground/80 transition hover:bg-surface hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              {n.label}
            </Link>
          ))}
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span>17+ Years</span><span>·</span><span>150+ Products</span><span>·</span><span>1000+ Partners</span>
          </div>
        </div>
      </nav>
    </header>
  );
}

function Badge({ count }: { count: number }) {
  return (
    <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-gold-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function MobileMenu({ onClose }: { onClose: () => void }) {
  const { data: cats = [] } = useQuery(categoriesQuery);
  const groups = ["led-lighting", "fans", "home-appliances"] as const;
  const groupLabel: Record<string, string> = {
    "led-lighting": "LED Lighting",
    fans: "Fans",
    "home-appliances": "Home Appliances",
  };
  const { user } = useAuth();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-2">
          <img src={auronaLogo.url} alt="Aurona" className="h-9 w-9 object-contain" />
          <span className="text-display text-lg font-semibold text-primary">AURONA</span>
        </div>
        <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-md" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <MobileLink to="/">Home</MobileLink>
        <MobileLink to="/products">All Products</MobileLink>
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
          <MobileLink to="/about">About Us</MobileLink>
          <MobileLink to="/affiliate">Affiliate</MobileLink>
          <MobileLink to="/careers">Careers</MobileLink>
          <MobileLink to="/blogs">Blogs</MobileLink>
          <MobileLink to="/contact">Contact</MobileLink>
          <MobileLink to={user ? "/account" : "/auth"}>{user ? "My Account" : "Sign In / Register"}</MobileLink>
        </div>
      </div>
    </div>
  );
}

function MobileLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="block border-t border-border px-3 py-3 text-sm font-semibold">
      {children}
    </Link>
  );
}
