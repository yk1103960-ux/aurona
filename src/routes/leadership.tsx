import { createFileRoute, Link } from "@tanstack/react-router";
import { Linkedin, Mail } from "lucide-react";

const LEADERS = [
  { role: "Founder", name: "—", bio: "Founder of Aurona Lighting Industries with a vision to make premium, reliable Indian‑manufactured lighting accessible to every home and business." },
  { role: "Managing Director / CEO", name: "—", bio: "Leads company strategy, growth, and long‑term vision across manufacturing, retail and B2B channels." },
  { role: "Director – Operations", name: "—", bio: "Oversees manufacturing, supply chain and quality assurance across the Aurona factory." },
  { role: "Head of Sales", name: "—", bio: "Drives national sales across retailer and distributor networks and key OEM accounts." },
  { role: "Head of Marketing", name: "—", bio: "Owns brand, digital marketing, and go‑to‑market for new product launches." },
  { role: "Finance Head", name: "—", bio: "Leads finance, compliance and investor relations." },
  { role: "HR Head", name: "—", bio: "Builds the Aurona team culture, hiring, and learning & development." },
  { role: "Manufacturing Head", name: "—", bio: "Runs the production floor, tooling, and continuous quality improvement." },
  { role: "Customer Success Head", name: "—", bio: "Owns the end‑to‑end customer and partner experience, from onboarding to after‑sales." },
  { role: "Operations Head", name: "—", bio: "Aligns cross‑functional operations across warehousing, logistics and channel fulfilment." },
];

export const Route = createFileRoute("/leadership")({
  head: () => ({ meta: [
    { title: "Leadership Team — Aurona Lighting Industries" },
    { name: "description", content: "Meet the leadership team behind Aurona Lighting Industries — driving India's premium LED and home‑appliance manufacturing." },
    { property: "og:title", content: "Leadership Team — Aurona" },
    { property: "og:description", content: "The people leading Aurona Lighting Industries." },
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
          A team of engineers, designers and operators committed to building lighting and appliances that India can rely on for decades.
        </p>
      </header>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {LEADERS.map((l) => (
          <article key={l.role} className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-2xl font-semibold text-primary">
              {(l.name && l.name !== "—" ? l.name : l.role).split(" ").map(w => w[0]).slice(0,2).join("")}
            </div>
            <div className="mt-5 text-eyebrow text-primary">{l.role}</div>
            <h3 className="mt-1 text-lg font-semibold text-foreground">{l.name}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{l.bio}</p>
            <div className="mt-4 flex gap-2 text-muted-foreground">
              <a href="#" aria-label="LinkedIn" className="grid h-8 w-8 place-items-center rounded-md border border-border hover:text-primary"><Linkedin className="h-4 w-4" /></a>
              <a href="mailto:hr@auronalighting.com" aria-label="Email" className="grid h-8 w-8 place-items-center rounded-md border border-border hover:text-primary"><Mail className="h-4 w-4" /></a>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-10 text-center text-xs text-muted-foreground">
        Names and photos will be updated as the company shares official profiles.
      </p>
    </div>
  );
}
