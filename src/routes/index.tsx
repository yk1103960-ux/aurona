import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Truck, ShieldCheck, Factory, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { categoriesQuery, productsQuery } from "@/lib/queries";
import { CategoryTile } from "@/components/product/ProductImage";
import { SectionTile } from "@/components/product/SectionTile";
import heroImg from "@/assets/hero-lighting.jpg";
import auronaLogo from "@/assets/aurona-logo.png.asset.json";

export const Route = createFileRoute("/")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(categoriesQuery);
    context.queryClient.ensureQueryData(productsQuery({ sale: true, limit: 4 }));
    context.queryClient.ensureQueryData(productsQuery({ featured: true, limit: 4 }));
    context.queryClient.ensureQueryData(productsQuery({ bestseller: true, limit: 4 }));
    context.queryClient.ensureQueryData(productsQuery({ isNew: true, limit: 4 }));
    context.queryClient.ensureQueryData(productsQuery({ categorySlug: "ceiling-fans", limit: 4 }));
    context.queryClient.ensureQueryData(productsQuery({ categorySlug: "panel-lights", limit: 4 }));
  },
  component: Home,
});

function Home() {
  const cats = useSuspenseQuery(categoriesQuery).data;
  const sale = useSuspenseQuery(productsQuery({ sale: true, limit: 4 })).data;
  const featured = useSuspenseQuery(productsQuery({ featured: true, limit: 4 })).data;
  const best = useSuspenseQuery(productsQuery({ bestseller: true, limit: 4 })).data;
  const news = useSuspenseQuery(productsQuery({ isNew: true, limit: 4 })).data;
  const fans = useSuspenseQuery(productsQuery({ categorySlug: "ceiling-fans", limit: 4 })).data;
  const panels = useSuspenseQuery(productsQuery({ categorySlug: "panel-lights", limit: 4 })).data;

  return (
    <div className="bg-surface">
      {/* CATEGORY STRIP — Flipkart style */}
      <section className="border-b border-border bg-background">
        <div className="container-x">
          <div className="scrollbar-hide flex gap-2 overflow-x-auto py-4 lg:justify-between lg:gap-4 lg:py-5">
            {cats.slice(0, 10).map((c) => (
              <Link
                key={c.id}
                to="/category/$slug"
                params={{ slug: c.slug }}
                className="group flex min-w-[80px] shrink-0 flex-col items-center gap-2 rounded-lg p-2 transition hover:bg-surface lg:min-w-[100px]"
              >
                <CategoryTile categoryIcon={c.icon} className="h-14 w-14 transition group-hover:scale-105 lg:h-16 lg:w-16" />
                <div className="text-center text-[11px] font-semibold leading-tight text-foreground lg:text-xs">
                  {c.name}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* HERO BANNER */}
      <section className="container-x py-4 lg:py-5">
        <div className="relative overflow-hidden rounded-lg border border-border bg-primary text-primary-foreground shadow-soft">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            <div className="flex flex-col justify-center px-6 py-8 lg:px-12 lg:py-14">
              <div className="flex items-center gap-3">
                <img src={auronaLogo.url} alt="" className="h-10 w-10 object-contain brightness-0 invert lg:h-12 lg:w-12" />
                <div className="text-eyebrow text-primary-foreground/70">Aurona · Est. 2007</div>
              </div>
              <h1 className="text-display mt-4 text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
                Innovating <span className="italic text-gold">the way</span> we light India.
              </h1>
              <p className="mt-4 max-w-lg text-sm text-primary-foreground/70 lg:text-base">
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
            <div className="relative aspect-[4/3] lg:aspect-auto">
              <img src={heroImg} alt="Aurona premium lighting" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/30 to-transparent lg:from-primary/60" />
            </div>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="border-y border-border bg-background">
        <div className="container-x grid grid-cols-2 gap-4 py-4 sm:grid-cols-4">
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

      {/* FLIPKART-STYLE SECTION GRID */}
      <section className="container-x space-y-3 py-4 lg:space-y-4 lg:py-5">
        {/* Row 1 */}
        <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
          <SectionTile
            title="Deals of the Day"
            subtitle="Up to 60% off — hurry"
            href="/deals"
            products={sale}
          />
          <SectionTile
            title="Best of Lighting"
            subtitle="Panel lights & downlights"
            href="/category/$slug"
            products={panels}
          />
        </div>

        {/* Row 2 */}
        <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
          <SectionTile
            title="Best Sellers"
            subtitle="India's most loved picks"
            href="/bestsellers"
            products={best}
          />
          <SectionTile
            title="New Arrivals"
            subtitle="Just launched"
            href="/new-arrivals"
            products={news}
          />
        </div>

        {/* Row 3 */}
        <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
          <SectionTile
            title="Featured Products"
            subtitle="Editor's picks"
            href="/featured"
            products={featured}
          />
          <SectionTile
            title="Cool Down with Fans"
            subtitle="Premium ceiling fans"
            href="/category/$slug"
            products={fans}
          />
        </div>
      </section>

      {/* CATEGORIES GRID — Flipkart-like tile block */}
      <section className="container-x pb-4">
        <div className="rounded-lg border border-border bg-card p-4 lg:p-6">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-lg font-bold lg:text-2xl">Shop by Category</h2>
            <Link to="/products" className="text-xs font-semibold text-gold hover:underline lg:text-sm">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6">
            {cats.slice(0, 12).map((c) => (
              <Link
                key={c.id}
                to="/category/$slug"
                params={{ slug: c.slug }}
                className="group flex flex-col items-center gap-2 rounded-lg border border-border bg-background p-3 transition hover:border-gold hover:shadow-soft"
              >
                <CategoryTile categoryIcon={c.icon} className="h-16 w-16" />
                <div className="text-center text-[11px] font-semibold leading-tight lg:text-xs">{c.name}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* BRAND STRIP */}
      <section className="container-x pb-8">
        <div className="grid gap-3 rounded-lg border border-border bg-card p-6 lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-8 lg:p-10">
          <img src={auronaLogo.url} alt="Aurona" className="h-20 w-20 object-contain lg:h-24 lg:w-24" />
          <div>
            <div className="text-eyebrow">Our story</div>
            <h2 className="text-display mt-2 text-2xl lg:text-3xl">Manufacturing that moves India forward.</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              17+ years · 150+ products · 1000+ retail partners · PAN India delivery.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:flex-col">
            <Button asChild className="rounded-full">
              <Link to="/about">About Aurona <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/affiliate">Become a Partner</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
