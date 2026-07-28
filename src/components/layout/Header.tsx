import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu, Search, Heart, ShoppingCart, User, ChevronDown, LayoutGrid, ImageIcon, ChevronRight, Lightbulb, Lamp, LampCeiling, LampDesk, LampFloor, Sun, Zap, Bath, Fan, Wind, Flame, Droplets, LayoutPanelTop, Grid3x3, TreePine, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const BROWSE_ICONS: Record<string, LucideIcon> = {
  "led-bulbs": Lightbulb,
  "street-lights": Lamp,
  "panel-lights": LayoutPanelTop,
  "interior-lights": LampDesk,
  "deep-lights": Sun,
  "flood-lights": Zap,
  "decorative-lights": Sparkles,
  "tube-lights": Grid3x3,
  "outdoor-lights": TreePine,
  "concealed-lights": LampCeiling,
  "pedestal-fans": Fan,
  "immersion-water-heater": Droplets,
  "ceiling-fans": Fan,
  "water-geysers": Bath,
  "exhaust-fans": Wind,
  heaters: Flame,
  madhani: LampFloor,
  "table-fans": Fan,
};
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

// Mega menu — matches client reference (6 columns, family names under each heading)
type MegaGroup = { heading: string; slug: string; items: string[] };
const LED_COLUMNS: MegaGroup[][] = [
  [
    { heading: "LED Bulbs", slug: "led-bulbs", items: ["Power+ Night Bulb", "High Glow", "Hammer", "Inverter Bulbs"] },
  ],
  [
    { heading: "Street Lights", slug: "street-lights", items: ["Lens", "Glass", "Slim Lens"] },
    { heading: "Panel Lights", slug: "panel-lights", items: ["Slim Panel", "Backlit Panel", "Adjustable Panel"] },
  ],
  [
    { heading: "Interior Lights", slug: "interior-lights", items: ["Delta COB", "Surface COB Cylinder", "Half Moon", "Mr. Four", "Mr. Four Small", "Mr. One", "Mr. Two", "Track Light"] },
  ],
  [
    { heading: "Deep Light", slug: "deep-lights", items: ["Mini Junction", "Royal", "Hexa"] },
    { heading: "Flood Light", slug: "flood-lights", items: ["Nova", "AuraLUX"] },
  ],
  [
    { heading: "Decorative", slug: "decorative-lights", items: ["Rope Way", "Strips", "Bluetooth High Bass"] },
    { heading: "Tubelight", slug: "tube-lights", items: ["Batten"] },
    { heading: "Outdoor Light", slug: "outdoor-lights", items: ["Gorden"] },
  ],
  [
    { heading: "Concealed", slug: "concealed-lights", items: ["Razer", "Zio", "Cob", "Joy", "Nexa", "Zelly", "Zade", "Happy", "Aura"] },
  ],
];

// Home Appliances mega menu — matches client reference (image 2)
const APPLIANCE_COLUMNS: MegaGroup[][] = [
  [
    { heading: "Pedestal Fan", slug: "pedestal-fans", items: ["Breeze Master", "Ventura Spin", "Cool Crest", "Aero pulse", "Whirlflow", "Airglide"] },
    { heading: "Immersion Water Heater", slug: "immersion-water-heater", items: ["Ecotherm"] },
  ],
  [
    { heading: "Ceiling Fans", slug: "ceiling-fans", items: ["Optimus", "Optimus Deco", "Orion", "Primus", "Spinger", "Sonata", "Windsor"] },
  ],
  [
    { heading: "Water Geysers", slug: "water-geysers", items: ["InstaHeat Plus", "Magma", "Heathub", "WarmNest", "ThermoFLEX"] },
    { heading: "Exhaust Fans", slug: "exhaust-fans", items: ["Vento", "Vento Plus"] },
  ],
  [
    { heading: "Room Heater", slug: "heaters", items: ["Sun Heater", "Tower", "Warmwhiz", "Radio", "Omega", "Maximus"] },
  ],
  [
    { heading: "Madhani", slug: "madhani", items: ["Mini", "Mini DLX", "Virat", "Virat DLX"] },
    { heading: "Table Fans", slug: "table-fans", items: ["Classic", "Magnus", "Rider", "AP Fan"] },
  ],
];

export function Header() {
  const navigate = useNavigate();
  const cart = useCart();
  const wl = useWishlist();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [openMobile, setOpenMobile] = useState(false);
  const [openMenu, setOpenMenu] = useState<null | "led" | "appliance" | "browse">(null);
  const megaOpen = openMenu !== null;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const scrolled = useScrolled(12);
  const { data: cats = [] } = useQuery(categoriesQuery);

  useEffect(() => setOpenMobile(false), [pathname]);
  useEffect(() => setOpenMenu(null), [pathname]);

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
      onMouseLeave={() => setOpenMenu(null)}
    >
      {/* Main bar */}
      <div
        className={cn(
          "container-x flex items-center justify-between text-foreground transition-[height] duration-500 lg:grid lg:grid-cols-[auto_1fr_auto] lg:gap-8",
          scrolled ? "h-[68px] lg:h-[80px]" : "h-[76px] lg:h-[96px]",
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
            className="flex min-w-0 flex-1 items-center justify-center px-2 py-1 lg:flex-none lg:justify-start lg:px-3 lg:py-1.5"
            aria-label="Aurona — Go Fearless in the Dark"
          >
            <img
              src={auronaLogo.url}
              alt="Aurona — Go Fearless in the Dark"
              className={cn(
                "w-auto shrink-0 object-contain mix-blend-multiply transition-[height,max-width] duration-500",
                scrolled ? "h-9 max-w-[180px] lg:h-10 lg:max-w-[200px]" : "h-11 max-w-[200px] lg:h-12 lg:max-w-[220px]",
              )}
            />
          </Link>
        </div>

        {/* Center: primary nav */}
        <nav className="hidden items-center justify-center gap-0.5 lg:flex">
          <BrowseTrigger
            isOpen={openMenu === "browse"}
            onOpen={() => setOpenMenu("browse")}
            onToggle={() => setOpenMenu((v) => (v === "browse" ? null : "browse"))}
          />
          <span className="mx-1 h-4 w-px bg-primary/15" aria-hidden />
          <NavItem to="/">Home</NavItem>
          <NavItem to="/products">All Products</NavItem>
          <MegaTrigger label="Home Appliances" isOpen={openMenu === "appliance"} onOpen={() => setOpenMenu("appliance")} onToggle={() => setOpenMenu((v) => (v === "appliance" ? null : "appliance"))} />
          <MegaTrigger label="LED Lightings" isOpen={openMenu === "led"} onOpen={() => setOpenMenu("led")} onToggle={() => setOpenMenu((v) => (v === "led" ? null : "led"))} />

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

      {/* Mega menu panels — desktop */}
      <MegaPanel
        open={openMenu === "led"}
        columns={LED_COLUMNS}
        onEnter={() => setOpenMenu("led")}
        onLeave={() => setOpenMenu(null)}
        catBySlug={catBySlug}
      />
      <MegaPanel
        open={openMenu === "appliance"}
        columns={APPLIANCE_COLUMNS}
        gridCols={5}
        onEnter={() => setOpenMenu("appliance")}
        onLeave={() => setOpenMenu(null)}
        catBySlug={catBySlug}
      />
      <BrowsePanel
        open={openMenu === "browse"}
        onEnter={() => setOpenMenu("browse")}
        onLeave={() => setOpenMenu(null)}
        cats={cats}
      />

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

function MegaTrigger({ label, isOpen, onOpen, onToggle }: { label: string; isOpen: boolean; onOpen: () => void; onToggle: () => void }) {
  return (
    <div className="relative" onMouseEnter={onOpen}>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "group relative inline-flex items-center gap-1 px-3.5 py-2 text-[11.5px] font-semibold uppercase tracking-[0.22em] transition-colors",
          isOpen ? "text-primary" : "text-foreground/72 hover:text-primary",
        )}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="relative">
          {label}
          <span className={cn(
            "pointer-events-none absolute -bottom-1 left-1/2 h-[2px] -translate-x-1/2 rounded-full bg-primary transition-all duration-300",
            isOpen ? "w-full" : "w-0 group-hover:w-full",
          )} />
        </span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", isOpen && "rotate-180")} />
      </button>
    </div>
  );
}

function MegaPanel({
  open,
  columns,
  gridCols = 6,
  onEnter,
  onLeave,
  catBySlug,
}: {
  open: boolean;
  columns: { heading: string; slug: string; items: string[] }[][];
  gridCols?: 5 | 6;
  onEnter: () => void;
  onLeave: () => void;
  catBySlug: (slug: string) => Category | undefined;
}) {
  const colsClass = gridCols === 5 ? "grid-cols-5" : "grid-cols-6";
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 top-full hidden origin-top overflow-hidden border-b border-primary/10 bg-white/98 shadow-[0_28px_60px_-28px_rgba(15,23,42,0.35)] backdrop-blur-xl transition-all duration-300 lg:block",
        open ? "pointer-events-auto opacity-100 translate-y-0" : "opacity-0 -translate-y-3",
      )}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div className={cn("container-x grid gap-x-8 gap-y-6 py-10", colsClass)}>
        {columns.map((col, ci) => (
          <div key={ci} className="min-w-0 space-y-6">
            {col.map((group) => {
              const cat = catBySlug(group.slug);
              return (
                <div key={group.heading}>
                  {cat ? (
                    <Link
                      to="/category/$slug"
                      params={{ slug: group.slug }}
                      className="block text-[11px] font-bold uppercase tracking-[0.22em] text-primary transition-colors hover:text-gold"
                    >
                      {group.heading}
                    </Link>
                  ) : (
                    <Link
                      to="/products"
                      search={{ q: group.heading } as never}
                      className="block text-[11px] font-bold uppercase tracking-[0.22em] text-primary transition-colors hover:text-gold"
                    >
                      {group.heading}
                    </Link>
                  )}
                  <ul className="mt-3 space-y-2">
                    {group.items.map((item) => (
                      <li key={item}>
                        <Link
                          to="/products"
                          search={{ q: item, cat: cat?.slug ?? "" } as never}
                          className="group/mi block text-[13.5px] leading-snug text-foreground/70 transition-all hover:translate-x-0.5 hover:text-primary"
                        >
                          <span className="border-b border-transparent group-hover/mi:border-primary/40">{item}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function BrowseTrigger({ isOpen, onOpen, onToggle }: { isOpen: boolean; onOpen: () => void; onToggle: () => void }) {
  return (
    <div className="relative" onMouseEnter={onOpen}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className={cn(
          "group inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[11.5px] font-bold uppercase tracking-[0.22em] transition-all",
          isOpen
            ? "border-primary bg-primary text-primary-foreground shadow-[0_6px_18px_-8px_oklch(0.55_0.14_240/0.55)]"
            : "border-primary/20 bg-white text-primary hover:border-primary/40 hover:bg-primary/5",
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" strokeWidth={2} />
        Browse Categories
        <ChevronDown className={cn("h-3 w-3 transition-transform", isOpen && "rotate-180")} />
      </button>
    </div>
  );
}

// Flattened catalog for browse panel — grouped by parent group
const BROWSE_GROUPS: { group: string; label: string; items: { heading: string; slug: string; sub: string[] }[] }[] = [
  {
    group: "led-lighting",
    label: "LED Lightings",
    items: [
      ...LED_COLUMNS.flat().map((g) => ({ heading: g.heading, slug: g.slug, sub: g.items })),
    ],
  },
  {
    group: "home-appliances",
    label: "Home Appliances",
    items: [
      ...APPLIANCE_COLUMNS.flat().map((g) => ({ heading: g.heading, slug: g.slug, sub: g.items })),
    ],
  },
];

function BrowsePanel({
  open,
  onEnter,
  onLeave,
  cats,
}: {
  open: boolean;
  onEnter: () => void;
  onLeave: () => void;
  cats: Category[];
}) {
  const flat = useMemo(() => BROWSE_GROUPS.flatMap((g) => g.items), []);
  const [activeSlug, setActiveSlug] = useState<string>(flat[0]?.slug ?? "");
  const [hoverItem, setHoverItem] = useState<string | null>(null);

  const active = flat.find((f) => f.slug === activeSlug) ?? flat[0];
  const activeCat = cats.find((c) => c.slug === active?.slug);

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 top-full hidden origin-top overflow-hidden border-b border-primary/10 bg-white shadow-[0_28px_60px_-28px_rgba(15,23,42,0.35)] transition-all duration-300 lg:block",
        open ? "pointer-events-auto opacity-100 translate-y-0" : "opacity-0 -translate-y-3",
      )}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div className="container-x grid grid-cols-[260px_1fr_320px] gap-0 py-0">
        {/* Left: category list grouped */}
        <div className="max-h-[70vh] overflow-y-auto border-r border-primary/10 bg-surface/40 py-4">
          {BROWSE_GROUPS.map((g) => (
            <div key={g.group} className="mb-2">
              <div className="px-5 pb-2 pt-3 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                {g.label}
              </div>
              {g.items.map((it) => (
                <button
                  key={it.slug}
                  type="button"
                  onMouseEnter={() => { setActiveSlug(it.slug); setHoverItem(null); }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-5 py-2.5 text-left text-[13px] font-semibold uppercase tracking-[0.12em] transition-colors",
                    activeSlug === it.slug
                      ? "bg-white text-primary"
                      : "text-foreground/75 hover:bg-white hover:text-primary",
                  )}
                >
                  <span className="truncate">{it.heading}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Middle: subcategory items */}
        <div className="max-h-[70vh] overflow-y-auto px-8 py-6">
          {active ? (
            <>
              <div className="mb-4 flex items-center justify-between">
                <Link
                  to="/category/$slug"
                  params={{ slug: active.slug }}
                  className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary hover:text-gold"
                >
                  {active.heading}
                </Link>
                <Link
                  to="/category/$slug"
                  params={{ slug: active.slug }}
                  className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary"
                >
                  View all →
                </Link>
              </div>
              <ul className="grid grid-cols-2 gap-x-6 gap-y-2">
                {active.sub.map((item) => (
                  <li key={item}>
                    <Link
                      to="/products"
                      search={{ q: item, cat: activeCat?.slug ?? "" } as never}
                      onMouseEnter={() => setHoverItem(item)}
                      className="group/mi block py-1.5 text-[13.5px] leading-snug text-foreground/75 transition-all hover:translate-x-0.5 hover:text-primary"
                    >
                      <span className="border-b border-transparent group-hover/mi:border-primary/40">{item}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              Hover over a category to see products
            </div>
          )}
        </div>

        {/* Right: image preview */}
        <div className="border-l border-primary/10 bg-surface/30">
          <div className="bg-primary px-5 py-3 text-center text-[10px] font-bold uppercase tracking-[0.28em] text-primary-foreground">
            Product Image
          </div>
          <div className="grid h-[calc(70vh-46px)] place-items-center p-6">
            {activeCat?.icon ? (
              <div className="w-full">
                <div className="aspect-square w-full overflow-hidden rounded-2xl border border-primary/10 bg-white">
                  <img src={activeCat.icon} alt={active?.heading} className="h-full w-full object-cover" loading="lazy" />
                </div>
                <div className="mt-3 text-center text-[12px] font-semibold uppercase tracking-[0.18em] text-foreground/80">
                  {hoverItem ?? active?.heading}
                </div>
                <Link
                  to="/category/$slug"
                  params={{ slug: active!.slug }}
                  className="mt-3 block text-center text-[10px] font-bold uppercase tracking-[0.24em] text-primary hover:text-gold"
                >
                  Shop {active?.heading} →
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
                <ImageIcon className="h-10 w-10" strokeWidth={1.4} />
                <span className="text-xs">Hover over a product to see details</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
