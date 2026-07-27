import { createFileRoute, Link } from "@tanstack/react-router";
import { Linkedin, Mail, Sparkles, Target, HeartHandshake, ShieldCheck, Leaf, Users } from "lucide-react";

type Leader = {
  role: string;
  name: string;
  initials: string;
  headline: string;
  bio: string;
  highlights: string[];
  email?: string;
};

const LEADERS: Leader[] = [
  {
    role: "Founder & CEO",
    name: "Manu Sharma",
    initials: "MS",
    headline: "Building India's most trusted lighting and appliances brand.",
    bio: "Manu founded Aurona Lighting Industries with a vision to make premium, reliable, Indian-manufactured lighting and home appliances accessible to every household and business. With deep expertise in manufacturing, distribution and retail, he leads company strategy, product innovation and long-term growth.",
    highlights: [
      "17+ years in lighting & manufacturing",
      "Led setup of Aurona's Rajasthan factory",
      "Focused on Made-in-India quality at global standards",
    ],
    email: "founder@auronalighting.com",
  },
  {
    role: "Co-Founder",
    name: "—",
    initials: "CF",
    headline: "Operations, supply chain and quality at scale.",
    bio: "As Co-Founder, they lead operations, manufacturing excellence and channel expansion — ensuring every Aurona product ships with the same consistency whether it goes to a home in Kerala or a distributor in the North-East.",
    highlights: [
      "Owns end-to-end operations & QA",
      "Scaled distributor network to 1,000+ partners",
      "Drives cost, quality and delivery KPIs",
    ],
    email: "operations@auronalighting.com",
  },
  {
    role: "Marketing Manager",
    name: "—",
    initials: "MM",
    headline: "Brand, digital growth and go-to-market.",
    bio: "Leads Aurona's brand story, digital marketing and go-to-market for new product launches — from retail merchandising to performance campaigns and partner enablement.",
    highlights: [
      "Owns brand & digital growth",
      "Runs GTM for every new product family",
      "Builds retailer & installer enablement",
    ],
    email: "marketing@auronalighting.com",
  },
];

const VALUES = [
  { icon: ShieldCheck, title: "Quality First", copy: "Every product is BIS-tested, warranty-backed and built to outlive its rated hours." },
  { icon: HeartHandshake, title: "Partners Win", copy: "Retailers, distributors and installers are treated as long-term partners, not transactions." },
  { icon: Leaf, title: "Made in India", copy: "Designed, engineered and manufactured at our Rajasthan facility with Indian talent." },
  { icon: Users, title: "Customer Obsession", copy: "Real humans on support, honest pricing and no-fuss replacement policies." },
];

export const Route = createFileRoute("/leadership")({
  head: () => ({ meta: [
    { title: "Leadership Team — Aurona Lighting Industries" },
    { name: "description", content: "Meet Manu Sharma and the leadership team building Aurona — India's premium LED lighting and home-appliance manufacturer." },
    { property: "og:title", content: "Leadership Team — Aurona" },
    { property: "og:description", content: "The people driving Aurona Lighting Industries — founder, co-founder and marketing leadership." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: LeadershipPage,
});

function LeadershipPage() {
  return (
    <div className="container-x py-14">
      <div className="mb-6 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link> /{" "}
        <Link to="/about" className="hover:text-foreground">About</Link> /{" "}
        <span className="text-foreground">Leadership Team</span>
      </div>

      <header className="mx-auto max-w-3xl text-center">
        <div className="text-eyebrow text-primary">Leadership</div>
        <h1 className="text-display mt-3 text-4xl md:text-5xl">The people behind Aurona</h1>
        <p className="mt-4 text-muted-foreground">
          A founder-led team of engineers, designers and operators building lighting and appliances India can rely on for decades.
        </p>
      </header>

      {/* Leaders */}
      <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {LEADERS.map((l) => (
          <article
            key={l.role}
            className="card-premium group flex h-full flex-col rounded-2xl border border-border bg-card p-7 transition-all hover:-translate-y-1 hover:border-primary/40"
          >
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-2xl font-semibold text-primary">
              {l.initials}
            </div>
            <div className="mt-5 text-eyebrow text-primary">{l.role}</div>
            <h3 className="mt-1 text-xl font-semibold text-foreground">{l.name}</h3>
            <p className="mt-1 text-sm italic text-muted-foreground">{l.headline}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{l.bio}</p>
            <ul className="mt-4 space-y-1.5 text-xs text-foreground/80">
              {l.highlights.map((h) => (
                <li key={h} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-primary" aria-hidden />
                  {h}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex gap-2 text-muted-foreground">
              <a href="#" aria-label="LinkedIn" className="grid h-9 w-9 place-items-center rounded-lg border border-border transition hover:border-primary/40 hover:text-primary">
                <Linkedin className="h-4 w-4" />
              </a>
              <a
                href={`mailto:${l.email ?? "hr@auronalighting.com"}`}
                aria-label="Email"
                className="grid h-9 w-9 place-items-center rounded-lg border border-border transition hover:border-primary/40 hover:text-primary"
              >
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </article>
        ))}
      </div>

      {/* Vision & Mission */}
      <section className="mt-16 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/8 to-primary/0 p-8">
          <Sparkles className="h-6 w-6 text-primary" />
          <h2 className="text-display mt-3 text-3xl">Our Vision</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            To be India's most trusted lighting and home-appliance brand — where every home,
            shop and workspace is powered by products designed and manufactured in India,
            without ever compromising on quality, safety or design.
          </p>
        </div>
        <div className="rounded-3xl border border-border bg-gradient-to-br from-accent/10 to-accent/0 p-8">
          <Target className="h-6 w-6 text-primary" />
          <h2 className="text-display mt-3 text-3xl">Our Mission</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Build premium, reliable, warranty-backed lighting and appliances at honest
            manufacturer pricing — and empower a nationwide network of retailers,
            distributors and installers to grow with us.
          </p>
        </div>
      </section>

      {/* Core Values */}
      <section className="mt-16">
        <div className="text-center">
          <div className="text-eyebrow text-primary">What we stand for</div>
          <h2 className="text-display mt-2 text-3xl md:text-4xl">Our Core Values</h2>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v) => (
            <div key={v.title} className="card-premium rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                <v.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">{v.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{v.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-14 text-center text-xs text-muted-foreground">
        Names and photos of the extended leadership team will be updated as the company shares official profiles.
      </p>
    </div>
  );
}
