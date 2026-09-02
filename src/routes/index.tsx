import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { categoriesQuery } from "@/lib/queries";
import { Counter } from "@/components/marketing/Counter";
import { CategoryCircles } from "@/components/collections/CategoryCircles";
import { HeroSlider } from "@/components/marketing/HeroSlider";
import { GoogleReviews } from "@/components/marketing/GoogleReviews";
import { SalesOfTheDay } from "@/components/marketing/SalesOfTheDay";
import { ProductRail } from "@/components/product/ProductRail";

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

  return (
    <div className="bg-background">
      {/* ============ HERO BANNER SLIDER ============ */}
      <HeroSlider />

      {/* ============ COUNTERS ============ */}
      <section className="border-b border-border bg-background">
        <div className="container-x grid grid-cols-2 gap-6 py-3 sm:grid-cols-4 lg:py-6">
          <Counter to={17} suffix="+" label="Years of manufacturing" />
          <Counter to={150} suffix="+" label="Products shipped" />
          <Counter to={1000} suffix="+" label="Retail partners" />
          <Counter to={28} label="States delivered" />
        </div>
      </section>

      {/* ============ MARQUEE ============ */}
      <div className="overflow-hidden border-y border-border bg-primary py-3 text-primary-foreground">
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

      {/* ============ SALE OF THE DAY — rotates every IST midnight ============ */}
      <SalesOfTheDay />

      {/* ============ FEATURE PRODUCTS ============ */}
      <ProductRail
        eyebrow="Handpicked"
        title={
          <>
            Feature <span className="italic text-primary">products</span>.
          </>
        }
        subtitle="Our most-loved fixtures and appliances, curated by the Aurona team."
        filter={{ featured: true }}
        viewAllTo="/featured"
      />

      {/* ============ BEST SELLING ============ */}
      <ProductRail
        eyebrow="Trending now"
        title={
          <>
            Best <span className="italic text-primary">selling</span>.
          </>
        }
        subtitle="What retailers and homeowners across India are ordering most."
        filter={{ bestseller: true }}
        viewAllTo="/bestsellers"
      />

      {/* ============ EDITORIAL SPLIT — luxury interior ============ */}
      <section className="relative overflow-hidden bg-surface py-10 lg:py-14">
        <div className="pointer-events-none absolute inset-0 editorial-grid opacity-30" aria-hidden />
        <div
          className="pointer-events-none absolute -left-40 top-1/4 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-gold)_16%,transparent),transparent_70%)] blur-3xl"
          aria-hidden
        />
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
              Every fixture is engineered at our Rajasthan facility — copper drivers, anti-glare optics, and finishes
              chosen to age with your home. Warmth by design, not by accident.
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
              <Link to="/about">
                Inside the Aurona factory <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ============ FAN EDITORIAL SPLIT ============ */}
      <section className="container-x py-10 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:gap-16">
          <div className="order-2 lg:order-1">
            <div className="text-eyebrow text-gold">03 · Air, refined</div>
            <h3 className="text-display mt-3 text-3xl leading-tight sm:text-4xl lg:text-5xl">
              Silent motors. <br />
              <span className="italic">Statement</span> blades.
            </h3>
            <p className="mt-5 max-w-md text-sm text-muted-foreground sm:text-base">
              Aurona fans move air the way a good tailor cuts a suit — quiet, precise, built to sit at the centre of the
              room.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild className="h-11 rounded-full bg-primary px-6 text-primary-foreground hover:bg-primary/90">
                <Link to="/category/$slug" params={{ slug: "ceiling-fans" }}>
                  Browse fans <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-full border-primary/20 px-6">
                <Link to="/products">View all products</Link>
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

      {/* ============ Google Reviews ============ */}
      <GoogleReviews />

      {/* ============ CTA — partner ============ */}
      <section className="container-x py-10 lg:py-14">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-primary p-8 text-primary-foreground sm:p-14 lg:p-20">
          <div
            className="orb-float absolute -right-20 -top-20 h-72 w-72 rounded-full bg-gold/25 blur-3xl"
            aria-hidden
          />
          <div
            className="orb-float-slow absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-gold/15 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
            }}
            aria-hidden
          />
          <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
            <div>
              <div className="text-eyebrow text-gold">04 · Stock Aurona</div>
              <h2 className="text-display mt-3 text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
                Retail with the brand
                <br />
                India is <span className="italic text-gold">wiring</span> its homes to.
              </h2>
              <p className="mt-5 max-w-lg text-sm text-primary-foreground/70 sm:text-base">
                1,000+ partners across 28 states. Margin, marketing kits and next-day dispatch from the factory.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-full bg-gold px-6 text-gold-foreground hover:bg-gold/90"
              >
                <Link to="/affiliate">
                  Become a partner <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-primary-foreground/25 bg-transparent px-6 text-primary-foreground hover:bg-primary-foreground/10"
              >
                <Link to="/contact">Talk to sales</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
