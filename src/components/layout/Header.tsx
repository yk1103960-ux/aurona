import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu, Search, Heart, ShoppingCart, User, ChevronDown, ImageIcon, ChevronRight, Lightbulb, Lamp, LampCeiling, LampDesk, LampFloor, Sun, Zap, Bath, Fan, Wind, Flame, Droplets, LayoutPanelTop, Grid3x3, TreePine, Sparkles, Globe, PhoneCall, HelpCircle, Mail, Facebook, Instagram, Linkedin, Youtube, Twitter } from "lucide-react";
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
import { categoriesQuery, browseProductsByCategoryQuery, searchSuggestQuery, type Category, type BrowseProduct, type SearchSuggestion } from "@/lib/queries";
import { siteSettingsQuery } from "@/lib/settings";

import { inr, discountPct } from "@/lib/format";
import { ProductImage } from "@/components/product/ProductImage";
import { cn } from "@/lib/utils";
import { useScrolled } from "@/hooks/useScrolled";
import auronaLogoWhite from "@/assets/aurona-logo-white.png.asset.json";

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
  const { data: settings } = useQuery(siteSettingsQuery);
  const [lang, setLang] = useState("en");


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
      {/* Utility strip — helpline, language, social, quick links */}
      <div className={cn("hidden overflow-hidden border-b border-primary/8 bg-gradient-to-r from-primary via-[oklch(0.52_0.13_248)] to-primary text-primary-foreground transition-all duration-500 lg:block", scrolled ? "max-h-0 opacity-0" : "max-h-12 opacity-100")}>
        <div className="container-x flex h-9 items-center justify-between text-[11.5px] font-medium tracking-[0.04em]">
          <div className="flex items-center gap-5">
            <a href={`tel:${(settings?.support_phone ?? "").replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-80">
              <PhoneCall className="h-3.5 w-3.5" strokeWidth={2} />
              Helpline: {settings?.support_phone ?? "+91 96025 70026"}
            </a>
            <span className="h-3 w-px bg-primary-foreground/25" aria-hidden />
            <a href={`mailto:${settings?.support_email ?? ""}`} className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-80">
              <Mail className="h-3.5 w-3.5" strokeWidth={2} />
              {settings?.support_email ?? "support@auronalighting.com"}
            </a>
          </div>
          <div className="flex items-center gap-5">
            <div className="inline-flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" strokeWidth={2} />
              <select
                aria-label="Language"
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="cursor-pointer rounded-md bg-transparent text-[11.5px] font-semibold text-primary-foreground outline-none [&>option]:text-foreground"
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
              </select>
            </div>
            <span className="h-3 w-px bg-primary-foreground/25" aria-hidden />
            <Link to="/contact" className="transition-opacity hover:opacity-80">Contact Us</Link>
            <Link to="/customer-service" className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-80">
              <HelpCircle className="h-3.5 w-3.5" strokeWidth={2} /> FAQs
            </Link>
            <span className="h-3 w-px bg-primary-foreground/25" aria-hidden />
            <div className="flex items-center gap-2.5">
              {([
                [settings?.social_facebook, Facebook, "Facebook"],
                [settings?.social_instagram, Instagram, "Instagram"],
                [settings?.social_twitter, Twitter, "X"],
                [settings?.social_youtube, Youtube, "YouTube"],
                [settings?.social_linkedin, Linkedin, "LinkedIn"],
              ] as [string | undefined, LucideIcon, string][]).map(([href, Icn, label]) => (
                <a key={label} href={href ?? "#"} target="_blank" rel="noreferrer" aria-label={label} className="transition-transform hover:-translate-y-0.5 hover:text-gold">
                  <Icn className="h-3.5 w-3.5" strokeWidth={2} />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main bar — deep navy so the white brand mark reads cleanly */}

      <div className="bg-nav text-nav-foreground">
      <div
        className={cn(
          "container-x flex items-center justify-between transition-[height] duration-500 lg:gap-6 xl:gap-8",
          scrolled ? "h-[68px] lg:h-[76px]" : "h-[76px] lg:h-[92px]",
        )}
      >
        {/* Left: hamburger (mobile) + logo cluster */}
        <div className="flex min-w-0 flex-1 items-center gap-2 lg:min-w-max lg:flex-none lg:shrink-0 lg:gap-3">
          <Sheet open={openMobile} onOpenChange={setOpenMobile}>
            <SheetTrigger asChild>
              <button
                className="press -ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-nav-foreground transition-colors hover:bg-white/10 lg:hidden"
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
            className="flex min-w-0 flex-1 items-center justify-center px-1 py-1 lg:min-w-max lg:flex-none lg:shrink-0 lg:justify-start lg:pl-0 lg:pr-3"
            aria-label="Aurona — Go Fearless in the Dark"
          >
            <img
              src={auronaLogoWhite.url}
              alt="Aurona — Go Fearless in the Dark"
              className={cn(
                "w-auto shrink-0 object-contain object-left transition-[height,max-width] duration-500",
                scrolled
                  ? "h-9 max-w-[210px] lg:h-12 lg:max-w-[320px]"
                  : "h-10 max-w-[230px] lg:h-[62px] lg:max-w-[380px]",
              )}
            />
          </Link>
        </div>


        {/* Center: large search with live suggestions */}
        <div className="hidden min-w-0 flex-1 justify-center px-4 lg:flex xl:px-8">
          <SearchBox value={q} onChange={setQ} onSubmit={submit} />
        </div>

        {/* Right: actions */}
        <div className="flex shrink-0 items-center justify-end gap-1 lg:gap-3 xl:gap-4">
          <Link
            to={user ? "/account" : "/auth"}
            className="group hidden items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 transition-all hover:border-white/45 hover:bg-white/15 lg:inline-flex"
          >
            <User className="h-[18px] w-[18px]" strokeWidth={1.9} />
            <span className="flex flex-col leading-none">
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] opacity-70">
                {user ? "Welcome" : "Account"}
              </span>
              <span className="mt-0.5 text-[12.5px] font-bold">
                {user ? "My Account" : "Login / Register"}
              </span>
            </span>
          </Link>
          <button
            onClick={() => document.getElementById("aurona-search-input")?.focus()}
            className="hidden h-11 w-11 place-items-center rounded-full transition-all hover:bg-white/10 hover:scale-105 sm:grid lg:hidden"
            aria-label="Search"
          >
            <Search className="h-[19px] w-[19px]" strokeWidth={1.75} />
          </button>
          <Link
            to={user ? "/account" : "/auth"}
            className="hidden h-11 w-11 place-items-center rounded-full transition-all hover:bg-white/10 hover:scale-105 sm:grid lg:hidden"
            aria-label="Account"
          >
            <User className="h-[19px] w-[19px]" strokeWidth={1.75} />
          </Link>
          <Link
            to="/wishlist"
            className="relative hidden h-11 w-11 place-items-center rounded-full transition-all hover:bg-white/10 hover:scale-105 sm:grid"
            aria-label="Wishlist"
          >
            <Heart className="h-[19px] w-[19px]" strokeWidth={1.75} />
            {wl.count > 0 && <Badge count={wl.count} />}
          </Link>
          <Link
            to="/cart"
            className="press relative -mr-2 grid h-10 w-10 place-items-center rounded-full transition-all hover:bg-white/10 hover:scale-105 lg:mr-0 lg:h-11 lg:w-11"
            aria-label="Cart"
          >
            <ShoppingCart className="h-6 w-6 lg:h-[19px] lg:w-[19px]" strokeWidth={1.75} />
            {cart.count > 0 && <Badge count={cart.count} />}
          </Link>
        </div>

      </div>
      </div>


      {/* Desktop nav row */}
      <nav className="hidden border-t border-primary/8 lg:block">
        <div className="container-x flex h-[52px] items-center gap-2">
          <BrowseTrigger
            isOpen={openMenu === "browse"}
            onOpen={() => setOpenMenu("browse")}
            onToggle={() => setOpenMenu((v) => (v === "browse" ? null : "browse"))}
          />
          <span className="mx-3 h-5 w-px shrink-0 bg-primary/15" aria-hidden />
          <div className="flex min-w-0 flex-1 items-center justify-start gap-0.5 overflow-hidden">
            <NavItem to="/">Home</NavItem>
            <span className="mx-1.5 h-4 w-px shrink-0 bg-primary/15" aria-hidden />
            <NavItem to="/products">All Products</NavItem>
            <span className="mx-1.5 h-4 w-px shrink-0 bg-primary/15" aria-hidden />
            <MegaTrigger label="Home Appliances" isOpen={openMenu === "appliance"} onOpen={() => setOpenMenu("appliance")} onToggle={() => setOpenMenu((v) => (v === "appliance" ? null : "appliance"))} />
            <span className="mx-1.5 h-4 w-px shrink-0 bg-primary/15" aria-hidden />
            <MegaTrigger label="LED Lightings" isOpen={openMenu === "led"} onOpen={() => setOpenMenu("led")} onToggle={() => setOpenMenu((v) => (v === "led" ? null : "led"))} />
            <span className="mx-1.5 h-4 w-px shrink-0 bg-primary/15" aria-hidden />
            <NavItem to="/affiliate">Affiliate With Us</NavItem>
            <span className="mx-1.5 h-4 w-px shrink-0 bg-primary/15" aria-hidden />
            <NavItem to="/careers">Career With Us</NavItem>
            <span className="mx-1.5 h-4 w-px shrink-0 bg-primary/15" aria-hidden />
            <NavItem to="/blogs">Blogs</NavItem>
            <span className="mx-1.5 h-4 w-px shrink-0 bg-primary/15" aria-hidden />
            <NavItem to="/about">About Us</NavItem>
            <span className="mx-1.5 hidden h-4 w-px shrink-0 bg-primary/15 xl:block" aria-hidden />
            <NavItem to="/contact" className="hidden xl:inline-block">Contact Us</NavItem>
          </div>
        </div>
      </nav>



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

function NavItem({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      to={to as never}
      className={cn(
        "group relative whitespace-nowrap px-2.5 py-2 text-[14px] font-bold tracking-[0.01em] text-foreground/85 transition-colors hover:text-primary",
        className,
      )}
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
      <div className="flex items-center justify-between border-b border-border bg-nav p-4">
        <img src={auronaLogoWhite.url} alt="Aurona" className="h-9 w-auto object-contain" />
      </div>

      <div className="scrollbar-visible flex-1 overflow-y-auto p-2">
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
          "group relative inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-2 text-[14px] font-bold tracking-[0.01em] transition-colors",
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
          "group inline-flex shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-1 py-2 text-[15px] font-extrabold tracking-[0.01em] transition-colors",
          isOpen ? "text-primary" : "text-foreground hover:text-primary",
        )}
      >
        <Menu className="h-[18px] w-[18px]" strokeWidth={2} />
        Browse Categories
        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
      </button>

    </div>
  );
}

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
  const [activeSlug, setActiveSlug] = useState<string>("");
  const [hoverProduct, setHoverProduct] = useState<BrowseProduct | null>(null);

  // Initialise once cats load
  useEffect(() => {
    if (!activeSlug && cats.length > 0) setActiveSlug(cats[0].slug);
  }, [cats, activeSlug]);

  const activeCat = cats.find((c) => c.slug === activeSlug);

  // Group cats by parent_group
  const groups = useMemo(() => {
    const map = new Map<string, Category[]>();
    for (const c of cats) {
      const g = c.parent_group ?? "other";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(c);
    }
    const labels: Record<string, string> = {
      "led-lighting": "LED Lightings",
      fans: "Fans",
      "home-appliances": "Home Appliances",
      other: "More",
    };
    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      label: labels[key] ?? key,
      items,
    }));
  }, [cats]);

  const { data: products = [], isLoading } = useQuery(browseProductsByCategoryQuery(activeSlug));

  return (
    <div
      className={cn(
        "container-x pointer-events-none absolute inset-x-0 top-full hidden origin-top pt-1 transition-all duration-300 lg:block",
        open ? "pointer-events-auto opacity-100 translate-y-0" : "opacity-0 -translate-y-3",
      )}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div className="grid w-full max-w-[1040px] grid-cols-[248px_minmax(0,1fr)_300px] gap-0 overflow-hidden rounded-2xl border border-primary/12 bg-white shadow-[0_28px_60px_-28px_rgba(15,23,42,0.35)]">
        {/* Left: dynamic category list with icons */}
        <div className="scrollbar-visible max-h-[70vh] overflow-y-auto border-r border-border bg-white py-0">
          {groups.map((g) => (
            <div key={g.key}>
              <div className="border-b border-border bg-surface/60 px-5 py-2 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground/80">
                {g.label}
              </div>
              {g.items.map((c) => {
                const Icon = BROWSE_ICONS[c.slug] ?? Lightbulb;
                const isActive = activeSlug === c.slug;
                return (
                  <button
                    key={c.slug}
                    type="button"
                    onMouseEnter={() => { setActiveSlug(c.slug); setHoverProduct(null); }}
                    className={cn(
                      "flex w-full items-center gap-3 border-b border-border px-5 py-3.5 text-left text-[14px] font-semibold uppercase tracking-[0.06em] transition-colors",
                      isActive
                        ? "bg-primary/8 text-primary"
                        : "text-foreground/85 hover:bg-primary/5 hover:text-primary",
                    )}
                  >
                    <Icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-primary" : "text-foreground/45")} strokeWidth={1.6} />
                    <span className="flex-1 truncate">{c.name}</span>
                    <ChevronRight className={cn("h-4 w-4 shrink-0", isActive ? "opacity-70" : "opacity-30")} />
                  </button>
                );
              })}
            </div>
          ))}
        </div>


        {/* Middle: products in active category */}
        <div className="scrollbar-visible max-h-[70vh] overflow-y-auto border-r border-border bg-white">
          {activeCat ? (
            <>
              <div className="flex items-center justify-between border-b border-border bg-surface/60 px-5 py-2">
                <Link
                  to="/products"
                  search={{ cat: activeCat.slug } as never}
                  className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground/80 hover:text-primary"
                >
                  {activeCat.name}
                </Link>
                <Link
                  to="/products"
                  search={{ cat: activeCat.slug } as never}
                  className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary"
                >
                  View all results →
                </Link>
              </div>
              {isLoading ? (
                <div className="space-y-3 p-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-5 animate-pulse rounded bg-primary/5" />
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No products yet in this category.
                </div>
              ) : (
                <ul>
                  {products.map((p) => {
                    const targetSlug = p.family_slug ?? p.slug;
                    const isHovered = hoverProduct?.slug === p.slug;
                    return (
                      <li key={p.slug}>
                        <Link
                          to="/products/$slug"
                          params={{ slug: targetSlug }}
                          onMouseEnter={() => setHoverProduct(p)}
                          className={cn(
                            "flex items-center gap-2 border-b border-border px-5 py-2.5 transition-colors",
                            isHovered ? "bg-primary/8" : "hover:bg-primary/5",
                          )}
                        >
                          <span className={cn("min-w-0 flex-1 truncate text-[13.5px] font-semibold leading-snug", isHovered ? "text-primary" : "text-foreground/90")}>
                            {p.name}
                          </span>
                          <ChevronRight className={cn("h-3.5 w-3.5 shrink-0", isHovered ? "text-primary opacity-80" : "opacity-25")} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              Hover over a category to see products
            </div>
          )}
        </div>

        {/* Right: hovered product preview */}
        <div className="bg-white">
          <div className="truncate bg-nav px-5 py-3 text-center text-[12.5px] font-bold uppercase tracking-[0.16em] text-nav-foreground">
            {hoverProduct?.name ?? activeCat?.name ?? "Product"}
          </div>
          <div className="grid h-[calc(70vh-46px)] place-items-center p-5">
            {hoverProduct ? (
              <div className="w-full">
                <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-surface/60">
                  {discountPct(hoverProduct.mrp ?? 0, hoverProduct.price ?? 0) > 0 && (
                    <span className="absolute left-3 top-3 z-10 rounded-md bg-primary px-2 py-1 text-[12px] font-bold text-primary-foreground">
                      -{discountPct(hoverProduct.mrp ?? 0, hoverProduct.price ?? 0)}%
                    </span>
                  )}
                  <ProductImage
                    product={{ slug: hoverProduct.slug, name: hoverProduct.name, image_seed: hoverProduct.image_seed }}
                    className="h-full w-full"
                    categoryIcon={activeCat?.icon ?? null}
                    eager
                  />
                </div>
                {hoverProduct.mrp && discountPct(hoverProduct.mrp, hoverProduct.price ?? 0) > 0 ? (
                  <div className="mt-3 text-center text-[13px] text-muted-foreground">
                    M.R.P.: <s>{inr(hoverProduct.mrp)}</s>
                  </div>
                ) : null}
                {hoverProduct.price ? (
                  <div className="mt-1 text-center text-[24px] font-bold text-primary">
                    {inr(hoverProduct.price)}
                  </div>
                ) : null}
                <Link
                  to="/products/$slug"
                  params={{ slug: hoverProduct.family_slug ?? hoverProduct.slug }}
                  className="mt-4 block rounded-full bg-gradient-to-r from-primary to-[oklch(0.52_0.13_248)] px-5 py-2.5 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-primary-foreground transition hover:brightness-110"
                >
                  View product
                </Link>
                {activeCat && (
                  <Link
                    to="/products"
                    search={{ cat: activeCat.slug } as never}
                    className="mt-2 block text-center text-[11px] font-bold uppercase tracking-[0.2em] text-primary hover:text-gold"
                  >
                    View all {activeCat.name} →
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
                <ImageIcon className="h-10 w-10" strokeWidth={1.4} />
                <span className="text-sm">Hover over a product to see details</span>
              </div>
            )}
          </div>
        </div>


      </div>
    </div>
  );
}


function SearchBox({ value, onChange, onSubmit }: { value: string; onChange: (v: string) => void; onSubmit: (e: React.FormEvent) => void }) {
  const [focused, setFocused] = useState(false);
  const [debounced, setDebounced] = useState(value);
  const box = useRef<HTMLDivElement>(null);
  const { data: allCats = [] } = useQuery(categoriesQuery);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), 220);
    return () => window.clearTimeout(t);
  }, [value]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const { data: results = [], isFetching } = useQuery(searchSuggestQuery(debounced));
  const show = focused && debounced.trim().length >= 2;

  return (
    <div ref={box} className="relative w-full max-w-[720px]">
      <form onSubmit={(e) => { setFocused(false); onSubmit(e); }}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-primary/70" strokeWidth={2} />
          <Input
            id="aurona-search-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder="Search LED bulbs, panel lights, ceiling fans, geysers or SKU…"
            className="h-[52px] rounded-full border-primary/20 bg-white pl-[52px] pr-[112px] text-[14px] font-medium text-foreground shadow-[0_2px_14px_-10px_oklch(0.55_0.14_240/0.55)] placeholder:font-normal placeholder:text-muted-foreground focus-visible:border-primary/45 focus-visible:ring-primary/25"
            autoComplete="off"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 grid h-9 -translate-y-1/2 place-items-center rounded-full bg-gradient-to-r from-primary to-[oklch(0.52_0.13_248)] px-6 text-[11px] font-bold uppercase tracking-[0.18em] text-primary-foreground shadow-sm transition hover:brightness-110 active:scale-[0.97]"
          >
            Search
          </button>
        </div>
      </form>

      {show && (
        <div className="absolute inset-x-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-primary/12 bg-white shadow-[0_28px_60px_-28px_rgba(15,23,42,0.35)]">
          {isFetching && results.length === 0 ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-primary/5" />)}
            </div>
          ) : results.length === 0 ? (
            <div className="px-5 py-6 text-sm text-muted-foreground">No products match “{debounced}”.</div>
          ) : (
            <>
              <ul className="max-h-[420px] overflow-y-auto">
                {results.map((r: SearchSuggestion) => {
                  const off = discountPct(r.mrp ?? 0, r.price ?? 0);
                  return (
                    <li key={r.slug}>
                      <Link
                        to="/products/$slug"
                        params={{ slug: r.slug }}
                        onClick={() => setFocused(false)}
                        className="flex items-center gap-3 border-b border-border/70 px-4 py-3 transition-colors last:border-0 hover:bg-primary/5"
                      >
                        <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-surface/60">
                          <ProductImage product={{ slug: r.slug, name: r.name, image_seed: r.image_seed }} className="h-full w-full" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold text-foreground">{r.name}</span>
                          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                            SKU {r.sku}{r.wattage ? ` · ${r.wattage}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          {r.price && r.price > 0 ? (
                            <>
                              <span className="block text-[14px] font-bold text-primary">{inr(r.price)}</span>
                              {off > 0 && (
                                <span className="block text-[11px] text-muted-foreground">
                                  <s>{inr(r.mrp ?? 0)}</s> <span className="font-semibold text-emerald-600">{off}% off</span>
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="block text-[11.5px] font-semibold text-muted-foreground">Price on request</span>
                          )}
                        </span>

                      </Link>
                    </li>
                  );
                })}
              </ul>
              <Link
                to="/products"
                search={(() => {
                  const term = debounced.trim();
                  const lower = term.toLowerCase();
                  const match = allCats.find(
                    (c) => c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase()),
                  );
                  return (match ? { q: "", cat: match.slug } : { q: term }) as never;
                })()}
                onClick={() => setFocused(false)}
                className="block bg-surface/60 px-5 py-3 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-primary transition-colors hover:bg-primary/8"
              >
                View all results →
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
