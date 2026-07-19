import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, Search, Sparkles, Star } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { categoriesQuery, productsQuery } from "@/lib/queries";
import { ProductCard } from "@/components/product/ProductCard";
import { Counter } from "@/components/marketing/Counter";
import { inr, discountPct } from "@/lib/format";
import { ProductImage } from "@/components/product/ProductImage";
import heroLux from "@/assets/hero-lux.jpg.asset.json";
import luxFan from "@/assets/lux-fan.jpg.asset.json";
import luxInterior from "@/assets/lux-interior.jpg.asset.json";
import auronaLogo from "@/assets/aurona-logo.png.asset.json";

const categoryImages = import.meta.glob<{ default: string }>(
  "../assets/categories/*.jpg",
  { eager: true }
);

export const Route = createFileRoute("/")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(categoriesQuery);
    context.queryClient.ensureQueryData(productsQuery({ sale: true, limit: 6 }));
    context.queryClient.ensureQueryData(productsQuery({ featured: true, limit: 6 }));
    context.queryClient.ensureQueryData(productsQuery({ bestseller: true, limit: 8 }));
    context.queryClient.ensureQueryData(productsQuery({ isNew: true, limit: 6 }));
  },
  component: Home,
  head: () => ({
    meta: [
      { title: "Aurona — Sculpted light, engineered in India" },
      {
        name: "description",
        content:
          "Aurona crafts sculptural lighting, ceiling fans and home appliances — 17 years of manufacturing, delivered across India.",
      },
    ],
  }),
});

function Home() {
  const navigate = useNavigate();
  const cats = useSuspenseQuery(categoriesQuery).data;
  const sale = useSuspenseQuery(productsQuery({ sale: true, limit: 6 })).data;
  const featured = useSuspenseQuery(productsQuery({ featured: true, limit: 6 })).data;
  const best = useSuspenseQuery(productsQuery({ bestseller: true, limit: 8 })).data;
  const news = useSuspenseQuery(productsQuery({ isNew: true, limit: 6 })).data;
  const [q, setQ] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    navigate({ to: "/products", search: { q: q.trim() } as never });
  };

  const marqueeItems = [
    "PAN India Delivery",
    "Genuine Products",
    "Manufacturer Direct",
    "17+ Years",
    "150+ SKUs",
    "1,000+ Partners",
  ];

  const hero = featured[0] ?? best[0];

  return (
    <div className="bg-background">
      {/* ============ CINEMATIC HERO ============ */}
      <section className="relative overflow-hidden bg-[oklch(0.11_0.015_260)] text-primary-foreground">
        {/* backdrop image */}
        <div className="absolute inset-0">
          <img
            src={heroLux.url}
            alt=""
            className="h-full w-full object-cover object-center opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[oklch(0.10_0.015_260)] via-[oklch(0.10_0.015_260/0.7)] to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.10_0.015_260)] via-transparent to-transparent" />
        </div>

        <div className="container-x relative">
          {/* top row */}
          <div className="flex items-center justify-between pt-8 lg:pt-12">
            <div className="flex items-center gap-2">
              <img src={auronaLogo.url} alt="" className="h-9 w-9 object-contain brightness-0 invert lg:h-10 lg:w-10" />
              <div className="text-[10px] uppercase tracking-[0.28em] text-primary-foreground/70">Est. 2007</div>
            </div>
            <Link
              to="/about"
              className="group hidden items-center gap-1.5 text-[11px] uppercase tracking-[0.24em] text-primary-foreground/70 hover:text-gold sm:flex"
            >
              The Aurona story
              <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* headline */}
          <div className="relative min-h-[560px] py-14 sm:py-20 lg:min-h-[720px] lg:py-32">
            <div className="max-w-2xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/5 px-3 py-1 backdrop-blur-sm">
                <Sparkles className="h-3 w-3 text-gold" />
                <span className="text-[10px] uppercase tracking-[0.22em] text-primary-foreground/80">
                  Winter Collection · 2026
                </span>
              </div>
              <h1 className="text-display text-[44px] leading-[0.95] tracking-tight sm:text-6xl lg:text-[112px]">
                Light,
                <br />
                <span className="italic text-gold">sculpted</span>
                <br />
                for India.
              </h1>
              <p className="mt-6 max-w-md text-sm text-primary-foreground/75 sm:text-base">
                Seventeen years of manufacturing, distilled into fixtures, fans and
                appliances that feel considered from the first click to the ceiling.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button
                  asChild
                  size="lg"
                  className="group h-12 rounded-full bg-gold px-6 text-gold-foreground hover:bg-gold/90"
                >
                  <Link to="/products">
                    Explore the collection
                    <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-full border-primary-foreground/25 bg-transparent px-6 text-primary-foreground hover:bg-primary-foreground/10"
                >
                  <Link to="/deals">Season deals</Link>
                </Button>
              </div>

              {/* inline search */}
              <form onSubmit={submit} className="mt-8 max-w-md">
                <div className="flex items-center gap-3 rounded-full border border-primary-foreground/20 bg-primary-foreground/5 px-4 py-2 backdrop-blur">
                  <Search className="h-4 w-4 text-primary-foreground/60" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search chandeliers, fans, panel lights…"
                    className="flex-1 bg-transparent text-sm text-primary-foreground placeholder:text-primary-foreground/50 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-full bg-gold px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gold-foreground"
                  >
                    Go
                  </button>
                </div>
              </form>
            </div>

            {/* featured floating card */}
            {hero && (
              <Link
                to="/products/$slug"
                params={{ slug: hero.slug }}
                className="group absolute bottom-6 right-0 hidden w-[280px] rounded-2xl border border-primary-foreground/15 bg-[oklch(0.14_0.02_260/0.7)] p-4 backdrop-blur-xl transition hover:border-gold/50 lg:block"
              >
                <div className="text-[10px] uppercase tracking-[0.2em] text-gold">Featured</div>
                <div className="mt-2 flex items-start gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg">
                    <ProductImage product={hero} categoryIcon={hero.categories?.icon} className="h-full w-full" iconClassName="h-8 w-8" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm font-semibold text-primary-foreground">
                      {hero.name}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-primary-foreground/60">
                      <Star className="h-3 w-3 fill-gold text-gold" /> {Number(hero.rating).toFixed(1)}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-primary-foreground/10 pt-3">
                  <div className="text-base font-semibold text-primary-foreground">{inr(hero.price)}</div>
                  <ArrowUpRight className="h-4 w-4 text-gold transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </div>
              </Link>
            )}
          </div>

          {/* counters */}
          <div className="grid grid-cols-2 gap-6 border-t border-primary-foreground/15 py-8 lg:grid-cols-4 lg:py-10">
            <Counter to={17} suffix="+" label="Years crafting" />
            <Counter to={150} suffix="+" label="Products shipped" />
            <Counter to={1000} suffix="+" label="Retail partners" />
            <Counter to={28} label="States delivered" />
          </div>
        </div>
      </section>

      {/* ============ MARQUEE ============ */}
      <div className="border-y border-border bg-primary py-3 text-primary-foreground">
        <div className="marquee flex gap-12 whitespace-nowrap">
          {[...marqueeItems, ...marqueeItems, ...marqueeItems].map((t, i) => (
            <span key={i} className="flex items-center gap-3 text-[11px] uppercase tracking-[0.32em]">
              <span className="h-1 w-1 rounded-full bg-gold" />
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* ============ CATEGORY EDITORIAL ============ */}
      <section className="container-x py-16 lg:py-24">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <div className="text-eyebrow text-gold">01 · Collections</div>
            <h2 className="text-display mt-3 text-4xl sm:text-5xl lg:text-6xl">
              A room for <span className="italic">every</span> light.
            </h2>
          </div>
          <Link to="/products" className="hidden text-sm font-semibold text-primary underline-offset-4 hover:text-gold hover:underline sm:block">
            View catalogue →
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cats.slice(0, 8).map((c, i) => {
            const img = categoryImages[`/src/assets/categories/${c.slug}.jpg`]?.default;
            return (
              <Link
                key={c.id}
                to="/category/$slug"
                params={{ slug: c.slug }}
                className="group relative flex aspect-[4/5] flex-col justify-between overflow-hidden rounded-2xl bg-surface p-5 transition hover:shadow-lift"
              >
                {img && (
                  <img
                    src={img}
                    alt={c.name}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20" />
                <div className="relative text-[11px] uppercase tracking-[0.24em] text-white/70">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="relative">
                  <div className="text-display text-2xl leading-tight text-white lg:text-3xl">
                    {c.name}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-gold">
                    Discover <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ============ EDITORIAL SPLIT — luxury interior ============ */}
      <section className="bg-surface py-16 lg:py-24">
        <div className="container-x grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div className="relative overflow-hidden rounded-2xl">
            <img
              src={luxInterior.url}
              alt="Warm cinematic interior lit by Aurona fixtures"
              className="aspect-[4/5] w-full object-cover"
              loading="lazy"
            />
            <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-background/95 p-4 backdrop-blur">
              <div className="text-[10px] uppercase tracking-[0.24em] text-gold">Case Study</div>
              <div className="mt-1 text-sm font-semibold text-primary">
                Bengaluru residence · lit entirely by Aurona
              </div>
            </div>
          </div>
          <div>
            <div className="text-eyebrow text-gold">02 · Craft</div>
            <h3 className="text-display mt-3 text-3xl leading-tight sm:text-4xl lg:text-5xl">
              We don't manufacture lights. We compose <span className="italic">rooms</span>.
            </h3>
            <p className="mt-5 max-w-md text-sm text-muted-foreground sm:text-base">
              Every fixture is engineered at our Karnataka facility — copper drivers,
              anti-glare optics, and finishes chosen to age with your home. Warmth by
              design, not by accident.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-4 border-t border-border pt-8">
              {[
                { k: "3.5K", l: "Warm CCT" },
                { k: "R9>95", l: "Colour render" },
                { k: "5yr", l: "Warranty" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="text-display text-2xl text-primary">{s.k}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{s.l}</div>
                </div>
              ))}
            </div>
            <Button asChild variant="outline" className="mt-8 h-11 rounded-full border-primary/20 px-6">
              <Link to="/about">Inside the Aurona factory <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ============ BEST SELLERS ============ */}
      <section className="container-x py-16 lg:py-24">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <div className="text-eyebrow text-gold">03 · The favourites</div>
            <h2 className="text-display mt-3 text-4xl sm:text-5xl lg:text-6xl">
              Loved by <span className="italic">India</span>.
            </h2>
          </div>
          <Link to="/bestsellers" className="hidden text-sm font-semibold text-primary underline-offset-4 hover:text-gold hover:underline sm:block">
            All bestsellers →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {best.slice(0, 8).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* ============ DEALS BAND — dark ============ */}
      <section className="bg-primary py-16 text-primary-foreground lg:py-24">
        <div className="container-x">
          <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-eyebrow text-gold">04 · Season sale</div>
              <h2 className="text-display mt-3 text-4xl sm:text-5xl lg:text-6xl">
                Up to <span className="italic text-gold">60% off</span>.
              </h2>
              <p className="mt-3 max-w-sm text-sm text-primary-foreground/70">
                Curated pieces from the current run — reduced for a limited window.
              </p>
            </div>
            <Link to="/deals" className="group inline-flex w-fit items-center gap-2 rounded-full border border-primary-foreground/20 px-5 py-2.5 text-sm font-semibold hover:border-gold hover:text-gold">
              Shop all deals <ArrowUpRight className="h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sale.slice(0, 6).map((p) => {
              const off = discountPct(p.mrp, p.price);
              return (
                <Link
                  key={p.id}
                  to="/products/$slug"
                  params={{ slug: p.slug }}
                  className="group relative flex overflow-hidden rounded-2xl border border-primary-foreground/10 bg-[oklch(0.16_0.02_260)] transition hover:border-gold/40"
                >
                  <div className="h-32 w-32 shrink-0 sm:h-36 sm:w-36">
                    <ProductImage product={p} categoryIcon={p.categories?.icon} className="h-full w-full rounded-none" iconClassName="h-12 w-12" />
                  </div>
                  <div className="flex flex-1 flex-col justify-between p-4">
                    <div>
                      <div className="line-clamp-2 text-sm font-semibold text-primary-foreground">{p.name}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-wider text-primary-foreground/50">{p.categories?.name}</div>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-lg font-semibold text-gold">{inr(p.price)}</div>
                        <div className="text-[11px] text-primary-foreground/50 line-through">{inr(p.mrp)}</div>
                      </div>
                      {off > 0 && (
                        <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold">
                          {off}% off
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ FAN EDITORIAL SPLIT ============ */}
      <section className="container-x py-16 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:gap-16">
          <div className="order-2 lg:order-1">
            <div className="text-eyebrow text-gold">05 · Air, refined</div>
            <h3 className="text-display mt-3 text-3xl leading-tight sm:text-4xl lg:text-5xl">
              Silent motors. <br />
              <span className="italic">Statement</span> blades.
            </h3>
            <p className="mt-5 max-w-md text-sm text-muted-foreground sm:text-base">
              Aurona fans move air the way a good tailor cuts a suit — quiet, precise,
              built to sit at the centre of the room.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild className="h-11 rounded-full bg-primary px-6 text-primary-foreground hover:bg-primary/90">
                <Link to="/category/$slug" params={{ slug: "ceiling-fans" }}>Browse fans <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-full border-primary/20 px-6">
                <Link to="/new-arrivals">New this season</Link>
              </Button>
            </div>
          </div>
          <div className="order-1 overflow-hidden rounded-2xl lg:order-2">
            <img
              src={luxFan.url}
              alt="Aurona matte-black ceiling fan with brushed gold accents"
              className="aspect-[4/5] w-full object-cover lg:aspect-[5/6]"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* ============ NEW ARRIVALS ============ */}
      <section className="bg-surface py-16 lg:py-24">
        <div className="container-x">
          <div className="mb-10 flex items-end justify-between gap-4">
            <div>
              <div className="text-eyebrow text-gold">06 · Just landed</div>
              <h2 className="text-display mt-3 text-4xl sm:text-5xl lg:text-6xl">
                New <span className="italic">arrivals</span>.
              </h2>
            </div>
            <Link to="/new-arrivals" className="hidden text-sm font-semibold text-primary underline-offset-4 hover:text-gold hover:underline sm:block">
              See everything →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {news.slice(0, 6).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      {/* ============ CTA — partner ============ */}
      <section className="container-x py-16 lg:py-24">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-primary p-8 text-primary-foreground sm:p-14 lg:p-20">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-gold/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
            <div>
              <div className="text-eyebrow text-gold">07 · Stock Aurona</div>
              <h2 className="text-display mt-3 text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
                Retail with the brand
                <br />
                India is <span className="italic text-gold">wiring</span> its homes to.
              </h2>
              <p className="mt-5 max-w-lg text-sm text-primary-foreground/70 sm:text-base">
                1,000+ partners across 28 states. Margin, marketing kits and next-day
                dispatch from the factory.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Button asChild size="lg" className="h-12 rounded-full bg-gold px-6 text-gold-foreground hover:bg-gold/90">
                <Link to="/affiliate">Become a partner <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-primary-foreground/25 bg-transparent px-6 text-primary-foreground hover:bg-primary-foreground/10">
                <Link to="/contact">Talk to sales</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
