import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Handshake, Store, Truck, Users, Building2, GraduationCap, Wrench, Factory, HardHat, Landmark, Briefcase, Share2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/partner/")({
  component: PartnerHub,
});

const PROGRAMS = [
  { slug: "retailer", title: "Become a Retailer", desc: "Stock Aurona in your store with retail-margin pricing and priority support.", Icon: Store },
  { slug: "distributor", title: "Become a Distributor", desc: "Territory rights, warehouse-backed supply, and channel margins.", Icon: Truck },
  { slug: "sales", title: "Sales Partner", desc: "Field sales program with incentives on booked orders.", Icon: Handshake },
  { slug: "reseller", title: "Reseller Partner", desc: "Online reseller / dropship program for marketplaces.", Icon: Share2 },
  { slug: "referral", title: "Referral Partner", desc: "Refer contractors and builders — earn on every closed order.", Icon: Users },
  { slug: "affiliate", title: "Affiliate Partner", desc: "Earn commission on every sale via your affiliate link.", Icon: Sparkles },
  { slug: "corporate", title: "Corporate Orders", desc: "Bulk lighting for offices, hotels, and enterprise campuses.", Icon: Briefcase },
  { slug: "government", title: "Government & Institutional", desc: "GeM & tender supply, PSU / municipal bodies, educational institutions.", Icon: Landmark },
  { slug: "architect", title: "Architect & Interior Designer", desc: "Spec-in program with samples, catalogs, and dedicated project support.", Icon: GraduationCap },
  { slug: "contractor", title: "Electrical Contractor", desc: "Project pricing, technical support, and priority dispatch.", Icon: Wrench },
  { slug: "oem", title: "OEM Partnership", desc: "White-label lighting manufactured to your specs.", Icon: Factory },
  { slug: "builder", title: "Builder & Developer", desc: "Turnkey lighting supply for residential and commercial projects.", Icon: HardHat },
  { slug: "career", title: "Career With Us", desc: "Join a growing lighting brand — sales, design, operations & more.", Icon: Briefcase },
];

function PartnerHub() {
  return (
    <div className="container-x py-14">
      <div className="mx-auto max-w-3xl text-center">
        <div className="text-eyebrow text-gold">Partner With Aurona</div>
        <h1 className="text-display mt-3 text-4xl md:text-5xl">Grow with a premium lighting brand</h1>
        <p className="mt-4 text-base text-muted-foreground">
          Aurona partners with retailers, distributors, contractors, architects, and enterprises across India — with manufacturer-direct pricing, dedicated support, and category-leading warranty.
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PROGRAMS.map(({ slug, title, desc, Icon }) => (
          <Link
            key={slug}
            to="/partner/$type"
            params={{ type: slug }}
            className="group flex flex-col rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-gold/40 hover:shadow-lg"
          >
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-lg bg-gold/10 text-gold">
              <Icon className="h-5 w-5" />
            </div>
            <div className="text-lg font-semibold">{title}</div>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">{desc}</p>
            <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-gold">
              Learn more <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
