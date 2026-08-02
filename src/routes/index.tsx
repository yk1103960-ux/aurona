import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { categoriesQuery } from "@/lib/queries";
import { Counter } from "@/components/marketing/Counter";
import { CategoryCircles } from "@/components/collections/CategoryCircles";
import { HeroSlider } from "@/components/marketing/HeroSlider";
import { GoogleReviews } from "@/components/marketing/GoogleReviews";
import luxFan from "@/assets/lux-fan.jpg.asset.json";
import luxInterior from "@/assets/lux-interior.jpg.asset.json";

export const Route = createFileRoute("/")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(categoriesQuery);
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
  const cats = useSuspenseQuery(categoriesQuery).data;

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
      {/* ============ HERO BANNER SLIDER ============ */}
      <HeroSlider />

      {/* ============ COUNTERS ============ */}
      <section className="border-b border-border bg-background">
        <div className="container-x grid grid-cols-2 gap-6 py-8 lg:grid-cols-4 lg:py-10">
          <Counter to={17} suffix="+" label="Years crafting" />
          <Counter to={150} suffix="+" label="Products shipped" />
          <Counter to={1000} suffix="+" label="Retail partners" />
          <Counter to={28} label="States delivered" />
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

      {/* ============ CATEGORY CIRCLES — premium round tiles ============ */}
      <CategoryCircles categories={cats} />

      {/* ============ SALES OF THE DAY ============ */}
      <SalesOfTheDay products={sale} />

      {/* ============ CATEGORY EDITORIAL — bento collections ============ */}
      <CollectionsGrid categories={cats} />



      {/* ============ EDITORIAL SPLIT — luxury interior ============ */}
      <section className="relative overflow-hidden bg-surface py-16 lg:py-24">
        <div className="pointer-events-none absolute inset-0 editorial-grid opacity-30" aria-hidden />
        <div className="pointer-events-none absolute -left-40 top-1/4 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-gold)_16%,transparent),transparent_70%)] blur-3xl" aria-hidden />
        <div className="container-x relative grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">

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
      <section className="relative overflow-hidden bg-background">
        <div className="pointer-events-none absolute inset-0 light-halo opacity-70" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px rule-editorial" aria-hidden />
        <div className="container-x relative py-16 lg:py-24">
          <div className="mb-10 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
            <div className="min-w-0">
              <div className="text-eyebrow text-gold">03 · The favourites</div>
              <h2 className="text-display mt-3 text-4xl leading-[1.02] sm:text-5xl lg:text-6xl">
                Loved by <span className="italic">India</span>.
              </h2>
            </div>
            <Link to="/bestsellers" className="hidden shrink-0 text-sm font-semibold text-primary underline-offset-4 hover:text-gold hover:underline sm:block">
              All bestsellers →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {best.slice(0, 8).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
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
                  className="group relative flex overflow-hidden rounded-2xl border border-primary-foreground/15 bg-primary-foreground/10 backdrop-blur transition hover:border-primary-foreground/40 hover:bg-primary-foreground/15"
                >
                  <div className="h-32 w-32 shrink-0 sm:h-36 sm:w-36">
                    <ProductImage product={p} categoryIcon={p.categories?.icon} className="h-full w-full rounded-none" iconClassName="h-12 w-12" />
                  </div>
                  <div className="flex flex-1 flex-col justify-between p-4">
                    <div>
                      <div className="line-clamp-2 text-sm font-semibold text-primary-foreground">{p.name}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-wider text-primary-foreground/60">{p.categories?.name}</div>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-lg font-semibold text-primary-foreground">{inr(p.price)}</div>
                        <div className="text-[11px] text-primary-foreground/50 line-through">{inr(p.mrp)}</div>
                      </div>
                      {off > 0 && (
                        <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
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
      <section className="relative overflow-hidden bg-surface grain py-16 lg:py-24">
        <div className="pointer-events-none absolute inset-0 editorial-grid opacity-40" aria-hidden />
        <div className="pointer-events-none absolute -right-24 top-10 h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-gold)_18%,transparent),transparent_70%)] blur-3xl" aria-hidden />
        <div className="container-x relative">
          <div className="mb-10 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
            <div className="min-w-0">
              <div className="text-eyebrow text-gold">06 · Just landed</div>
              <h2 className="text-display mt-3 text-4xl leading-[1.02] sm:text-5xl lg:text-6xl">
                New <span className="italic">arrivals</span>.
              </h2>
            </div>
            <Link to="/new-arrivals" className="hidden shrink-0 text-sm font-semibold text-primary underline-offset-4 hover:text-gold hover:underline sm:block">
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

      {/* ============ Google Reviews ============ */}
      <GoogleReviews />

      {/* ============ CTA — partner ============ */}
      <section className="container-x py-16 lg:py-24">

        <div className="relative overflow-hidden rounded-3xl border border-border bg-primary p-8 text-primary-foreground sm:p-14 lg:p-20">
          <div className="orb-float absolute -right-20 -top-20 h-72 w-72 rounded-full bg-gold/25 blur-3xl" aria-hidden />
          <div className="orb-float-slow absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-gold/15 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay" style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")" }} aria-hidden />
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
