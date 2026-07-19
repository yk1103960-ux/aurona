import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Truck, ShieldCheck, Factory, PackageCheck, Search, MapPin, Camera, Mic, Zap, Sparkles, Percent, Package, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { categoriesQuery, productsQuery } from "@/lib/queries";
import { CategoryTile } from "@/components/product/ProductImage";
import { SectionTile } from "@/components/product/SectionTile";
import { ProductCard } from "@/components/product/ProductCard";
import heroImg from "@/assets/hero-lighting.jpg";
import promoLed from "@/assets/promo-led.jpg";
import promoFan from "@/assets/promo-fan.jpg";
import promoChandelier from "@/assets/promo-chandelier.jpg";
import auronaLogo from "@/assets/aurona-logo.png.asset.json";

export const Route = createFileRoute("/")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(categoriesQuery);
    context.queryClient.ensureQueryData(productsQuery({ sale: true, limit: 6 }));
    context.queryClient.ensureQueryData(productsQuery({ featured: true, limit: 4 }));
    context.queryClient.ensureQueryData(productsQuery({ bestseller: true, limit: 6 }));
    context.queryClient.ensureQueryData(productsQuery({ isNew: true, limit: 4 }));
    context.queryClient.ensureQueryData(productsQuery({ categorySlug: "ceiling-fans", limit: 4 }));
    context.queryClient.ensureQueryData(productsQuery({ categorySlug: "panel-lights", limit: 4 }));
  },
  component: Home,
});

const SHORTCUTS = [
  { label: "Aurona", sub: "Store", icon: "logo", bg: "bg-gold", to: "/products" },
  { label: "Quick", sub: "30 min", icon: Zap, bg: "bg-background", to: "/deals" },
  { label: "Deals", sub: "60% off", icon: Percent, bg: "bg-background", to: "/deals" },
  { label: "New", sub: "Arrivals", icon: Sparkles, bg: "bg-background", to: "/new-arrivals" },
] as const;

function Home() {
  const navigate = useNavigate();
  const cats = useSuspenseQuery(categoriesQuery).data;
  const sale = useSuspenseQuery(productsQuery({ sale: true, limit: 6 })).data;
  const featured = useSuspenseQuery(productsQuery({ featured: true, limit: 4 })).data;
  const best = useSuspenseQuery(productsQuery({ bestseller: true, limit: 6 })).data;
  const news = useSuspenseQuery(productsQuery({ isNew: true, limit: 4 })).data;
  const fans = useSuspenseQuery(productsQuery({ categorySlug: "ceiling-fans", limit: 4 })).data;
  const panels = useSuspenseQuery(productsQuery({ categorySlug: "panel-lights", limit: 4 })).data;
  const [q, setQ] = useState("");
  const [heroIdx, setHeroIdx] = useState(0);

  const banners = [
    { img: promoLed, tag: "Smart LED Sale", copy: "Up to 60% off", href: "/deals" },
    { img: promoChandelier, tag: "Luxury Lighting", copy: "New chandeliers", href: "/category/$slug", slug: "panel-lights" },
    { img: promoFan, tag: "Cool Season", copy: "Premium fans", href: "/category/$slug", slug: "ceiling-fans" },
  ];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    navigate({ to: "/products", search: { q: q.trim() } as never });
  };

  return (
    <div className="bg-surface">
      {/* ============ MOBILE FLIPKART-STYLE TOP (mobile only) ============ */}
      <div className="lg:hidden">
        {/* Blue gradient wash */}
        <section className="relative bg-gradient-to-b from-[oklch(0.85_0.08_240)] via-[oklch(0.92_0.05_235)] to-surface pb-3">
          {/* Shortcut cards */}
          <div className="px-3 pt-3">
            <div className="grid grid-cols-4 gap-2">
              {SHORTCUTS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <Link
                    key={s.label}
                    to={s.to}
                    className={`flex flex-col items-center gap-1 rounded-xl border border-border/50 bg-background p-2 shadow-soft ${i === 0 ? "!bg-gold" : ""}`}
                  >
                    <div className="grid h-9 w-9 place-items-center">
                      {Icon === "logo" ? (
                        <img src={auronaLogo.url} alt="" className="h-8 w-8 object-contain" />
                      ) : (
                        <Icon className="h-6 w-6 text-primary" strokeWidth={1.8} />
                      )}
                    </div>
                    <div className="text-[11px] font-bold leading-none text-primary">{s.label}</div>
                    <div className="text-[9px] font-medium leading-none text-primary/70">{s.sub}</div>
                  </Link>
                );
              })}

            </div>
          </div>

          {/* Location bar */}
          <div className="mt-3 px-3">
            <div className="flex items-center gap-2 rounded-lg bg-background/80 px-3 py-2 backdrop-blur">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1 truncate text-xs font-semibold text-primary">
                Deliver to <span className="font-normal text-muted-foreground">Ground Floor, 2nd Main Road…</span>
              </div>
              <div className="flex items-center gap-1 rounded-md bg-gold/20 px-2 py-1">
                <Zap className="h-3 w-3 text-gold" strokeWidth={2.5} />
                <span className="text-[10px] font-bold text-primary">0</span>
              </div>
            </div>
          </div>

          {/* Search */}
          <form onSubmit={submit} className="mt-3 px-3">
            <div className="relative flex items-center rounded-xl border-2 border-gold/60 bg-background px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search LEDs, fans, appliances…"
                className="flex-1 bg-transparent px-2 py-2.5 text-sm outline-none"
              />
              <button type="button" aria-label="Camera" className="grid h-8 w-8 place-items-center text-muted-foreground">
                <Camera className="h-4 w-4" />
              </button>
              <button type="button" aria-label="Voice" className="grid h-8 w-8 place-items-center text-muted-foreground">
                <Mic className="h-4 w-4" />
              </button>
            </div>
          </form>

          {/* Category icons scroller */}
          <div className="mt-3">
            <div className="scrollbar-hide flex gap-1 overflow-x-auto px-3 pb-1">
              {cats.slice(0, 12).map((c) => (
                <Link
                  key={c.id}
                  to="/category/$slug"
                  params={{ slug: c.slug }}
                  className="flex min-w-[68px] shrink-0 flex-col items-center gap-1.5 rounded-lg p-1"
                >
                  <CategoryTile categoryIcon={c.icon} className="h-12 w-12" />
                  <div className="max-w-[64px] truncate text-center text-[10px] font-semibold text-primary">{c.name}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Hero banner carousel */}
        <section className="px-3 pt-3">
          <div className="overflow-hidden rounded-xl border border-border bg-primary shadow-soft">
            <Link
              to={banners[heroIdx].href}
              params={banners[heroIdx].slug ? { slug: banners[heroIdx].slug } : undefined as never}
              className="relative block aspect-[16/9]"
            >
              <img src={banners[heroIdx].img} alt={banners[heroIdx].tag} className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary/80 to-transparent p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gold">{banners[heroIdx].tag}</div>
                <div className="text-sm font-bold text-primary-foreground">{banners[heroIdx].copy}</div>
              </div>
              <div className="absolute right-2 top-2 rounded-md bg-background/80 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                AD
              </div>
            </Link>
            <div className="flex justify-center gap-1.5 bg-background py-2">
              {banners.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setHeroIdx(i)}
                  aria-label={`Slide ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${i === heroIdx ? "w-6 bg-primary" : "w-1.5 bg-border-strong"}`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* "Still browsing?" horizontal cards */}
        <section className="mt-3">
          <div className="rounded-xl bg-[oklch(0.95_0.03_240)] px-3 py-4">
            <h3 className="mb-3 text-base font-bold text-primary">Still browsing?</h3>
            <div className="scrollbar-hide -mx-3 flex gap-3 overflow-x-auto px-3 pb-1">
              {sale.slice(0, 6).map((p) => (
                <Link
                  key={p.id}
                  to="/products/$slug"
                  params={{ slug: p.slug }}
                  className="flex w-[130px] shrink-0 flex-col overflow-hidden rounded-lg bg-background shadow-soft"
                >
                  <div className="product-gradient-amber aspect-square" />
                  <div className="p-2">
                    <div className="line-clamp-1 text-xs font-semibold text-primary">{p.name}</div>
                    <div className="mt-0.5 text-[11px] font-bold text-gold">View →</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Suggested for you grid */}
        <section className="mt-3 bg-background px-3 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-bold text-primary">Suggested for you</h3>
            <Link to="/products" aria-label="See all" className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground">
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {best.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>

        {/* Deals band */}
        <section className="mt-3 bg-background px-3 py-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-eyebrow text-gold">Limited time</div>
              <h3 className="text-base font-bold text-primary">Deals of the Day</h3>
            </div>
            <Link to="/deals" className="flex items-center gap-1 text-xs font-bold text-gold">
              All <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="scrollbar-hide -mx-3 flex gap-3 overflow-x-auto px-3">
            {sale.slice(0, 6).map((p) => (
              <div key={p.id} className="w-[150px] shrink-0">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </section>

        {/* New arrivals band */}
        <section className="mt-3 bg-background px-3 py-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-eyebrow text-gold">Just launched</div>
              <h3 className="text-base font-bold text-primary">New Arrivals</h3>
            </div>
            <Link to="/new-arrivals" className="flex items-center gap-1 text-xs font-bold text-gold">
              All <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {news.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>

        {/* Trust strip mobile */}
        <section className="mt-3 border-y border-border bg-background">
          <div className="grid grid-cols-2 gap-3 px-3 py-4">
            {[
              { Icon: Truck, k: "PAN India", l: "Delivery" },
              { Icon: ShieldCheck, k: "Genuine", l: "Products" },
              { Icon: Factory, k: "Since 2007", l: "Manufacturer" },
              { Icon: PackageCheck, k: "150+", l: "Products" },
            ].map(({ Icon, k, l }) => (
              <div key={l} className="flex items-center gap-2">
                <Icon className="h-5 w-5 shrink-0 text-gold" strokeWidth={1.5} />
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold leading-tight text-primary">{k}</div>
                  <div className="truncate text-[10px] text-muted-foreground">{l}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Brand story mobile */}
        <section className="mt-3 px-3 pb-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <img src={auronaLogo.url} alt="Aurona" className="h-14 w-14 object-contain" />
            <div className="text-eyebrow mt-3">Our story</div>
            <h2 className="text-display mt-1 text-xl text-primary">Manufacturing that moves India forward.</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              17+ years · 150+ products · 1000+ retail partners · PAN India delivery.
            </p>
            <div className="mt-3 flex gap-2">
              <Button asChild size="sm" className="rounded-full">
                <Link to="/about">About</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <Link to="/affiliate">Partner</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>

      {/* ============ DESKTOP LAYOUT (unchanged core) ============ */}
      <div className="hidden lg:block">
        {/* CATEGORY STRIP */}
        <section className="border-b border-border bg-background">
          <div className="container-x">
            <div className="flex justify-between gap-4 py-5">
              {cats.slice(0, 10).map((c) => (
                <Link
                  key={c.id}
                  to="/category/$slug"
                  params={{ slug: c.slug }}
                  className="group flex min-w-[100px] shrink-0 flex-col items-center gap-2 rounded-lg p-2 transition hover:bg-surface"
                >
                  <CategoryTile categoryIcon={c.icon} className="h-16 w-16 transition group-hover:scale-105" />
                  <div className="text-center text-xs font-semibold leading-tight">{c.name}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* HERO */}
        <section className="container-x py-5">
          <div className="relative overflow-hidden rounded-lg border border-border bg-primary text-primary-foreground shadow-soft">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
              <div className="flex flex-col justify-center px-12 py-14">
                <div className="flex items-center gap-3">
                  <img src={auronaLogo.url} alt="" className="h-12 w-12 object-contain brightness-0 invert" />
                  <div className="text-eyebrow text-primary-foreground/70">Aurona · Est. 2007</div>
                </div>
                <h1 className="text-display mt-4 text-6xl leading-[1.05]">
                  Innovating <span className="italic text-gold">the way</span> we light India.
                </h1>
                <p className="mt-4 max-w-lg text-base text-primary-foreground/70">
                  Smart lighting, fans and home appliances — manufactured and delivered across India.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild size="lg" className="rounded-full bg-gold text-gold-foreground hover:bg-gold/90">
                    <Link to="/products">Shop All <ArrowRight className="ml-2 h-4 w-4" /></Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="rounded-full border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
                    <Link to="/deals">View Deals</Link>
                  </Button>
                </div>
              </div>
              <div className="relative">
                <img src={heroImg} alt="Aurona premium lighting" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-primary/60 via-transparent to-transparent" />
              </div>
            </div>
          </div>
        </section>

        {/* TRUST STRIP */}
        <section className="border-y border-border bg-background">
          <div className="container-x grid grid-cols-4 gap-4 py-4">
            {[
              { Icon: Truck, k: "PAN India", l: "Delivery" },
              { Icon: ShieldCheck, k: "Genuine", l: "Products" },
              { Icon: Factory, k: "Since 2007", l: "Manufacturer" },
              { Icon: PackageCheck, k: "150+", l: "Products" },
            ].map(({ Icon, k, l }) => (
              <div key={l} className="flex items-center gap-3">
                <Icon className="h-6 w-6 shrink-0 text-gold" strokeWidth={1.5} />
                <div>
                  <div className="text-sm font-bold leading-tight">{k}</div>
                  <div className="text-[11px] text-muted-foreground">{l}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="container-x space-y-4 py-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionTile title="Deals of the Day" subtitle="Up to 60% off — hurry" href="/deals" products={sale.slice(0, 4)} />
            <SectionTile title="Best of Lighting" subtitle="Panel lights & downlights" href="/category/$slug" params={{ slug: "panel-lights" }} products={panels} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionTile title="Best Sellers" subtitle="India's most loved picks" href="/bestsellers" products={best.slice(0, 4)} />
            <SectionTile title="New Arrivals" subtitle="Just launched" href="/new-arrivals" products={news} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionTile title="Featured Products" subtitle="Editor's picks" href="/featured" products={featured} />
            <SectionTile title="Cool Down with Fans" subtitle="Premium ceiling fans" href="/category/$slug" params={{ slug: "ceiling-fans" }} products={fans} />
          </div>
        </section>

        <section className="container-x pb-4">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex items-end justify-between">
              <h2 className="text-2xl font-bold">Shop by Category</h2>
              <Link to="/products" className="text-sm font-semibold text-gold hover:underline">View all →</Link>
            </div>
            <div className="grid grid-cols-6 gap-3">
              {cats.slice(0, 12).map((c) => (
                <Link key={c.id} to="/category/$slug" params={{ slug: c.slug }} className="group flex flex-col items-center gap-2 rounded-lg border border-border bg-background p-3 transition hover:border-gold hover:shadow-soft">
                  <CategoryTile categoryIcon={c.icon} className="h-16 w-16" />
                  <div className="text-center text-xs font-semibold leading-tight">{c.name}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="container-x pb-8">
          <div className="grid gap-8 rounded-lg border border-border bg-card p-10 lg:grid-cols-[auto_1fr_auto] lg:items-center">
            <img src={auronaLogo.url} alt="Aurona" className="h-24 w-24 object-contain" />
            <div>
              <div className="text-eyebrow">Our story</div>
              <h2 className="text-display mt-2 text-3xl">Manufacturing that moves India forward.</h2>
              <p className="mt-2 text-sm text-muted-foreground">17+ years · 150+ products · 1000+ retail partners · PAN India delivery.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Button asChild className="rounded-full"><Link to="/about">About Aurona <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
              <Button asChild variant="outline" className="rounded-full"><Link to="/affiliate">Become a Partner</Link></Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
