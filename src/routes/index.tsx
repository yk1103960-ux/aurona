import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Award, Factory, Truck, Shield, Users, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { categoriesQuery, productsQuery } from "@/lib/queries";
import { ProductCard } from "@/components/product/ProductCard";
import { CategoryTile } from "@/components/product/ProductImage";
import heroImg from "@/assets/hero-lighting.jpg";

export const Route = createFileRoute("/")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(categoriesQuery);
    context.queryClient.ensureQueryData(productsQuery({ sale: true, limit: 4 }));
    context.queryClient.ensureQueryData(productsQuery({ featured: true, limit: 8 }));
    context.queryClient.ensureQueryData(productsQuery({ bestseller: true, limit: 4 }));
    context.queryClient.ensureQueryData(productsQuery({ isNew: true, limit: 4 }));
  },
  component: Home,
});

function Home() {
  const cats = useSuspenseQuery(categoriesQuery).data;
  const sale = useSuspenseQuery(productsQuery({ sale: true, limit: 4 })).data;
  const featured = useSuspenseQuery(productsQuery({ featured: true, limit: 8 })).data;
  const best = useSuspenseQuery(productsQuery({ bestseller: true, limit: 4 })).data;
  const news = useSuspenseQuery(productsQuery({ isNew: true, limit: 4 })).data;

  return (
    <div>
      {/* HERO */}
      <section className="bg-surface">
        <div className="container-x grid gap-10 py-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-20">
          <div className="flex flex-col justify-center">
            <div className="text-eyebrow mb-5 flex items-center gap-2">
              <span className="inline-block h-px w-8 bg-gold" />
              Aurona · Est. 2007
            </div>
            <h1 className="text-display text-5xl leading-[1.02] sm:text-6xl lg:text-7xl">
              Innovating <br />
              <span className="italic text-gold">the way</span> we light India.
            </h1>
            <p className="mt-6 max-w-lg text-base text-muted-foreground sm:text-lg">
              Smart lighting, fans and home appliances — engineered, manufactured and delivered
              across India by Aurona Lighting Industries.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 rounded-full px-6 text-sm">
                <Link to="/products">Shop all products <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-full px-6 text-sm">
                <Link to="/products" search={{ group: "led-lighting" } as never}>Explore lighting</Link>
              </Button>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-background shadow-lift">
              <img
                src={heroImg}
                alt="Aurona premium LED downlights and ceiling fan"
                width={1920}
                height={1280}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 left-6 hidden rounded-xl border border-border bg-card px-5 py-4 shadow-lift sm:block">
              <div className="text-eyebrow">Trusted since 2007</div>
              <div className="mt-1 text-display text-2xl">17+ years of excellence</div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="border-y border-border bg-background">
        <div className="container-x grid grid-cols-2 gap-6 py-8 sm:grid-cols-4">
          {[
            { k: "17+", l: "Years of excellence" },
            { k: "150+", l: "Products" },
            { k: "1000+", l: "Retail partners" },
            { k: "PAN", l: "India reach" },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <div className="text-display text-3xl sm:text-4xl">{s.k}</div>
              <div className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="container-x py-16">
        <SectionHead eyebrow="Explore" title="Shop by category" href="/products" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {cats.slice(0, 12).map((c) => (
            <Link
              key={c.id}
              to="/category/$slug"
              params={{ slug: c.slug }}
              className="group flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-border-strong hover:shadow-lift"
            >
              <CategoryTile categoryIcon={c.icon} className="h-20 w-20 transition group-hover:bg-accent" />
              <div className="text-center">
                <div className="text-sm font-semibold">{c.name}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">Shop now →</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* SALE OF THE DAY */}
      {sale.length > 0 && (
        <section className="bg-surface-warm">
          <div className="container-x py-16">
            <SectionHead eyebrow="Deals" title="Sale of the day" href="/products" hrefLabel="View all sale" />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {sale.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}

      {/* FEATURED */}
      <section className="container-x py-16">
        <SectionHead eyebrow="Featured" title="Featured products" href="/products" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {featured.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>

      {/* WHY AURONA */}
      <section className="bg-primary text-primary-foreground">
        <div className="container-x py-20">
          <div className="max-w-2xl">
            <div className="text-eyebrow text-primary-foreground/70">Why Aurona</div>
            <h2 className="text-display mt-3 text-4xl sm:text-5xl">Built for India. Engineered for tomorrow.</h2>
            <p className="mt-4 max-w-xl text-primary-foreground/70">
              A manufacturing-first brand delivering serious quality, thoughtful engineering and reliable
              service to homes, businesses, retailers and distributors nationwide.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { Icon: Award, t: "Premium quality", d: "Locally manufactured to global standards." },
              { Icon: Factory, t: "17+ years experience", d: "Established in 2007, trusted at scale." },
              { Icon: Users, t: "1000+ retail partners", d: "Trusted across every state in India." },
              { Icon: PackageCheck, t: "150+ products", d: "Extensive lighting & appliance portfolio." },
              { Icon: Truck, t: "PAN India delivery", d: "Fast, reliable shipping nationwide." },
              { Icon: Shield, t: "After-sales support", d: "Warranty backed by responsive service." },
            ].map(({ Icon, t, d }) => (
              <div key={t} className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/[0.03] p-6">
                <Icon className="h-6 w-6 text-gold" strokeWidth={1.5} />
                <div className="mt-4 text-lg font-semibold">{t}</div>
                <div className="mt-1 text-sm text-primary-foreground/70">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BEST SELLING */}
      {best.length > 0 && (
        <section className="container-x py-16">
          <SectionHead eyebrow="Popular" title="Best selling" href="/products" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {best.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {/* NEW ARRIVALS */}
      {news.length > 0 && (
        <section className="bg-surface">
          <div className="container-x py-16">
            <SectionHead eyebrow="Fresh" title="New arrivals" href="/products" />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {news.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}

      {/* BRAND STORY / CTA */}
      <section className="container-x py-20">
        <div className="grid gap-10 rounded-3xl border border-border bg-surface p-8 lg:grid-cols-[1.2fr_1fr] lg:p-14">
          <div>
            <div className="text-eyebrow">Our story</div>
            <h2 className="text-display mt-3 text-4xl sm:text-5xl">Manufacturing that moves India forward.</h2>
            <p className="mt-4 max-w-xl text-muted-foreground">
              Aurona Lighting Industries combines manufacturing expertise, product innovation and reliable
              service — for modern homes, businesses, retailers and distributors across India.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full">
                <Link to="/about">About Aurona <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <Link to="/affiliate">Become a partner</Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { y: "2007", t: "Founded" },
              { y: "150+", t: "Products" },
              { y: "1000+", t: "Partners" },
              { y: "PAN", t: "India" },
            ].map((s) => (
              <div key={s.t} className="rounded-2xl bg-background p-6">
                <div className="text-display text-3xl">{s.y}</div>
                <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{s.t}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHead({
  eyebrow, title, href, hrefLabel = "View all",
}: { eyebrow: string; title: string; href: string; hrefLabel?: string }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        <div className="text-eyebrow">{eyebrow}</div>
        <h2 className="text-display mt-2 text-3xl sm:text-4xl">{title}</h2>
      </div>
      <Link to={href} className="hidden shrink-0 items-center gap-1 text-sm font-medium text-foreground hover:text-gold sm:inline-flex">
        {hrefLabel} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
