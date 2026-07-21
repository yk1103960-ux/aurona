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
        "fixed inset-x-0 top-0 z-40 transition-[background-color,backdrop-filter,border-color,box-shadow,height] duration-500",
        "border-b bg-white/85 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70",
        scrolled
          ? "border-primary/10 shadow-[0_8px_28px_-16px_oklch(0.55_0.14_240/0.35)]"
          : "border-primary/8 shadow-[0_1px_0_0_oklch(0.55_0.14_240/0.06)]",
      )}
    >
      {/* Main bar */}
      <div
        className={cn(
          "container-x flex items-center justify-between gap-3 text-foreground transition-[height] duration-500 lg:grid lg:grid-cols-[auto_1fr_auto] lg:gap-10",
          scrolled ? "h-16 lg:h-[72px]" : "h-[68px] lg:h-[84px]",
        )}
      >
        {/* Left: hamburger + logo */}
        <div className="flex min-w-0 items-center gap-3">
          <Sheet open={openMobile} onOpenChange={setOpenMobile}>
            <SheetTrigger asChild>
              <button
                className="press grid h-11 w-11 shrink-0 place-items-center rounded-full text-primary transition-colors hover:bg-primary/8 lg:hidden"
                aria-label="Menu"
              >
                <Menu className="h-[22px] w-[22px]" strokeWidth={1.75} />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[86vw] max-w-sm border-border bg-background p-0 text-foreground">
              <MobileMenu onClose={() => setOpenMobile(false)} />
            </SheetContent>
          </Sheet>
          <Link to="/" className="group flex min-w-0 items-center gap-3">
            <img
              src={auronaLogo.url}
              alt="Aurona"
              className={cn(
                "shrink-0 object-contain drop-shadow-[0_2px_6px_oklch(0.55_0.14_240/0.18)] transition-[height,width] duration-500",
                scrolled ? "h-9 w-9 lg:h-10 lg:w-10" : "h-10 w-10 lg:h-[46px] lg:w-[46px]",
              )}
            />
            <span className="text-display text-[17px] font-semibold uppercase tracking-[0.34em] text-primary lg:text-[19px]">
              Aurona
            </span>
          </Link>
        </div>

        {/* Center: premium nav */}
        <nav className="hidden items-center justify-center gap-1 lg:flex">
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
              className="group relative px-3.5 py-2 text-[11.5px] font-semibold uppercase tracking-[0.22em] text-foreground/72 transition-colors hover:text-primary"
              activeProps={{ className: "text-primary" }}
            >
              <span className="relative">
                {n.label}
                <span className="pointer-events-none absolute -bottom-1 left-1/2 h-[2px] w-0 -translate-x-1/2 rounded-full bg-primary transition-all duration-300 group-hover:w-full" />
              </span>
            </Link>
          ))}
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
            className="relative grid h-11 w-11 place-items-center rounded-full text-primary transition-all hover:bg-primary/8 hover:scale-105"
            aria-label="Cart"
          >
            <ShoppingCart className="h-[19px] w-[19px]" strokeWidth={1.75} />
            {cart.count > 0 && <Badge count={cart.count} />}
          </Link>
        </div>
      </div>

      {/* Mobile inline search — hidden until scrolled to reduce clutter over hero */}
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
        <div className="flex items-center gap-3">
          <img src={auronaLogo.url} alt="Aurona" className="h-10 w-10 object-contain" />
          <span className="text-display text-lg font-semibold uppercase tracking-[0.32em] text-primary">Aurona</span>
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
