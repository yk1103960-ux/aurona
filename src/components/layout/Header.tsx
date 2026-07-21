import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu, Search, Heart, ShoppingCart, User, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

export function Header() {
  const navigate = useNavigate();
  const cart = useCart();
  const wl = useWishlist();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [openMobile, setOpenMobile] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const scrolled = useScrolled(12);

  useEffect(() => setOpenMobile(false), [pathname]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    navigate({ to: "/products", search: { q: q.trim() } as never });
  };

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-[background-color,backdrop-filter,border-color,box-shadow] duration-500",
        scrolled
          ? "border-b border-white/10 bg-[oklch(0.13_0.003_60/0.72)] backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )}
    >
      {/* Main bar */}
      <div
        className={cn(
          "container-x flex items-center justify-between gap-2 text-[oklch(0.955_0.008_85)] transition-[height] duration-500 lg:grid lg:grid-cols-[auto_1fr_auto] lg:gap-8",
          scrolled ? "h-14 lg:h-16" : "h-16 lg:h-20",
        )}
      >
        {/* Left: hamburger + logo */}
        <div className="flex min-w-0 items-center gap-3">
          <Sheet open={openMobile} onOpenChange={setOpenMobile}>
            <SheetTrigger asChild>
              <button className="press grid h-10 w-10 shrink-0 place-items-center text-current lg:hidden" aria-label="Menu">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[86vw] max-w-sm border-white/10 bg-[oklch(0.14_0.003_60)] p-0 text-[oklch(0.955_0.008_85)]">
              <MobileMenu onClose={() => setOpenMobile(false)} />
            </SheetContent>
          </Sheet>
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <img
              src={auronaLogo.url}
              alt="Aurona"
              className={cn(
                "shrink-0 object-contain brightness-0 invert transition-[height,width] duration-500",
                scrolled ? "h-7 w-7 lg:h-8 lg:w-8" : "h-8 w-8 lg:h-9 lg:w-9",
              )}
            />
            <span className="text-display text-[15px] font-medium uppercase tracking-[0.32em] text-current lg:text-base">
              Aurona
            </span>
          </Link>
        </div>

        {/* Center: minimal editorial nav */}
        <nav className="hidden items-center justify-center gap-8 lg:flex">
          {[
            { label: "Shop", to: "/products" },
            { label: "Collections", to: "/products" },
            { label: "Interior Lighting", to: "/category/$slug", params: { slug: "interior-lights" } },
            { label: "Mirror Lights", to: "/category/$slug", params: { slug: "mirror-lights" } },
            { label: "About", to: "/about" },
          ].map((n) => (
            <Link
              key={n.label}
              to={n.to as never}
              params={n.params as never}
              className="text-[11px] font-medium uppercase tracking-[0.24em] text-current/85 transition-colors hover:text-[oklch(0.85_0.09_82)]"
              activeProps={{ className: "text-[oklch(0.85_0.09_82)]" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        {/* Right: actions */}
        <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-1.5">
          <button
            onClick={() => document.getElementById("aurona-search-input")?.focus()}
            className="hidden h-10 w-10 place-items-center text-current transition hover:text-[oklch(0.85_0.09_82)] sm:grid"
            aria-label="Search"
          >
            <Search className="h-[18px] w-[18px]" />
          </button>
          <Link to="/wishlist" className="relative hidden h-10 w-10 place-items-center text-current transition hover:text-[oklch(0.85_0.09_82)] sm:grid" aria-label="Wishlist">
            <Heart className="h-[18px] w-[18px]" />
            {wl.count > 0 && <Badge count={wl.count} />}
          </Link>
          <Link to={user ? "/account" : "/auth"} className="hidden h-10 w-10 place-items-center text-current transition hover:text-[oklch(0.85_0.09_82)] sm:grid" aria-label="Account">
            <User className="h-[18px] w-[18px]" />
          </Link>
          <Link to="/cart" className="relative -mr-2 grid h-10 w-10 place-items-center text-current transition hover:text-[oklch(0.85_0.09_82)] sm:-mr-1" aria-label="Cart">
            <ShoppingCart className="h-[18px] w-[18px]" />
            {cart.count > 0 && <Badge count={cart.count} />}
          </Link>
        </div>
      </div>

      {/* Mobile inline search — hidden until scrolled to reduce clutter over hero */}
      {scrolled && (
        <div className="border-t border-white/10 px-3 py-2 lg:hidden">
          <form onSubmit={submit}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[oklch(0.66_0.008_70)]" />
              <Input
                id="aurona-search-input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search Aurona"
                className="h-10 rounded-none border-white/15 bg-transparent pl-10 pr-16 text-sm text-[oklch(0.955_0.008_85)] placeholder:text-[oklch(0.66_0.008_70)] focus-visible:ring-[oklch(0.77_0.09_82)]"
              />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[oklch(0.85_0.09_82)]">
                Go
              </button>
            </div>
          </form>
        </div>
      )}

    </header>
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
        "absolute -right-0.5 -top-0.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-gold-foreground",
        pop && "badge-pop",
      )}
    >
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
