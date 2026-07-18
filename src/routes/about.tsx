import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, Factory, Users, PackageCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Aurona — 17+ Years of Lighting Innovation" },
      { name: "description", content: "Founded in 2007, Aurona Lighting Industries manufactures premium LED lighting, fans and home appliances for modern India." },
    ],
  }),
  component: About,
});

function About() {
  return (
    <div>
      <section className="bg-surface">
        <div className="container-x py-16 lg:py-24">
          <div className="text-eyebrow">About Aurona</div>
          <h1 className="text-display mt-3 max-w-3xl text-5xl sm:text-6xl">Built for India. Engineered for tomorrow.</h1>
          <p className="mt-6 max-w-2xl text-muted-foreground">
            Aurona Lighting Industries has been designing and manufacturing premium lighting and home
            appliance solutions for Indian homes and businesses since 2007 — combining engineering
            expertise, industrial scale and reliable service.
          </p>
        </div>
      </section>

      <section className="container-x py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { Icon: Award, k: "17+", l: "Years of excellence" },
            { Icon: PackageCheck, k: "150+", l: "Products" },
            { Icon: Users, k: "1000+", l: "Retail partners" },
            { Icon: Factory, k: "Make in India", l: "Manufacturing" },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl border border-border p-6">
              <s.Icon className="h-6 w-6 text-gold" strokeWidth={1.5} />
              <div className="text-display mt-4 text-3xl">{s.k}</div>
              <div className="mt-1 text-sm text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="container-x py-16">
        <h2 className="text-display text-3xl sm:text-4xl">Our journey</h2>
        <div className="mt-8 space-y-6">
          {[
            { y: "2007", t: "Founded", d: "Aurona Lighting Industries starts manufacturing LED lighting for Indian homes." },
            { y: "2013", t: "Product expansion", d: "Portfolio grows to include panels, downlights and outdoor lighting." },
            { y: "2018", t: "PAN India network", d: "Distribution scales to 1000+ retail partners across the country." },
            { y: "Today", t: "150+ products", d: "A complete lighting, fan and appliance portfolio serving modern India." },
          ].map((s) => (
            <div key={s.y} className="grid grid-cols-[80px_1fr] gap-6 rounded-xl border-l-2 border-gold bg-surface p-6">
              <div className="text-display text-2xl">{s.y}</div>
              <div>
                <div className="font-semibold">{s.t}</div>
                <div className="mt-1 text-sm text-muted-foreground">{s.d}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container-x pb-24">
        <div className="rounded-3xl bg-primary p-10 text-primary-foreground">
          <h2 className="text-display text-3xl">Partner with Aurona</h2>
          <p className="mt-2 max-w-xl text-primary-foreground/70">Join 1000+ retailers and distributors already growing with Aurona.</p>
          <Button asChild size="lg" className="mt-6 rounded-full bg-gold text-gold-foreground hover:bg-gold/90">
            <Link to="/affiliate">Become a partner <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
