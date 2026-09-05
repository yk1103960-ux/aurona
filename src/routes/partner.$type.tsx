import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type PartnerType =
  | "retailer"
  | "distributor"
  | "sales"
  | "reseller"
  | "referral"
  | "affiliate"
  | "corporate"
  | "government"
  | "architect"
  | "contractor"
  | "oem"
  | "builder"
  | "career";

const PROGRAMS: Record<
  PartnerType,
  {
    title: string;
    blurb: string;
    benefits: string[];
    eligibility: string[];
    faqs: { q: string; a: string }[];
    fields: (
      | "business_name"
      | "owner_name"
      | "gstin"
      | "pan"
      | "cin"
      | "business_type"
      | "years_in_business"
      | "expected_monthly_purchase"
      | "distribution_area"
      | "warehouse_capacity"
      | "sales_team_size"
      | "existing_brands"
      | "monthly_purchase_volume"
    )[];
  }
> = {
  retailer: {
    title: "Become an Aurona Retailer",
    blurb:
      "Stock Aurona in your shop with retailer-margin pricing, dedicated relationship manager, and priority dispatch.",
    benefits: [
      "Retail-margin pricing (unlocked after approval)",
      "POS + display support",
      "Warranty replacement, no questions asked",
      "Priority dispatch across India",
    ],
    eligibility: ["Active GST registration", "Physical retail shop", "Minimum monthly purchase commitment"],
    faqs: [
      {
        q: "How long does approval take?",
        a: "Applications are reviewed within 3 business days. You'll receive an email once approved.",
      },
      {
        q: "When does retailer pricing show?",
        a: "Retailer pricing unlocks in your account only after admin approval.",
      },
    ],
    fields: [
      "business_name",
      "owner_name",
      "gstin",
      "pan",
      "business_type",
      "years_in_business",
      "expected_monthly_purchase",
    ],
  },
  distributor: {
    title: "Become an Aurona Distributor",
    blurb:
      "Territory-exclusive distribution rights with channel margins, warehouse-backed supply, and joint marketing.",
    benefits: [
      "Territory rights",
      "Channel-partner margins",
      "Marketing co-op & POSM",
      "Dedicated relationship manager",
    ],
    eligibility: [
      "Company registration + GST + PAN + CIN",
      "Warehouse with minimum capacity",
      "Existing sales team & distribution network",
    ],
    faqs: [
      {
        q: "What territories are available?",
        a: "Please indicate your preferred territory below; our team will confirm exclusivity in your area.",
      },
      { q: "What's the onboarding process?", a: "Application → document verification → territory MoU → onboarding." },
    ],
    fields: [
      "business_name",
      "owner_name",
      "gstin",
      "pan",
      "cin",
      "distribution_area",
      "warehouse_capacity",
      "sales_team_size",
      "existing_brands",
      "monthly_purchase_volume",
    ],
  },
  sales: {
    title: "Sales Partner Program",
    blurb: "Field sales program with performance-based incentives on every booked order.",
    benefits: ["Attractive incentives", "Lead assignments", "Sales collateral"],
    eligibility: ["Prior B2B sales experience preferred"],
    faqs: [],
    fields: ["business_name", "years_in_business", "distribution_area"],
  },
  reseller: {
    title: "Reseller Partner Program",
    blurb: "Online reseller / dropship program for marketplaces and D2C storefronts.",
    benefits: ["Reseller pricing", "Product data feeds", "Dropship support"],
    eligibility: ["Active online storefront", "GST registration"],
    faqs: [],
    fields: ["business_name", "gstin", "monthly_purchase_volume"],
  },
  referral: {
    title: "Referral Partner Program",
    blurb: "Refer contractors, architects, and builders — earn on every closed order.",
    benefits: ["Commission on every closed lead", "Dedicated referral dashboard", "Fast payouts"],
    eligibility: ["Individual or firm"],
    faqs: [],
    fields: ["business_name"],
  },
  affiliate: {
    title: "Affiliate Partner Program",
    blurb: "Earn commission on every sale via your affiliate link. Perfect for content creators & bloggers.",
    benefits: ["Recurring commissions", "Real-time tracking", "Marketing creatives"],
    eligibility: ["Active website / social presence"],
    faqs: [],
    fields: [],
  },
  corporate: {
    title: "Corporate Orders",
    blurb: "Bulk lighting for offices, hotels, retail chains, and enterprise campuses.",
    benefits: ["Bulk pricing", "Custom SKUs", "Project-based warranty"],
    eligibility: ["Company GST"],
    faqs: [],
    fields: ["business_name", "gstin", "expected_monthly_purchase"],
  },
  government: {
    title: "Government & Institutional",
    blurb: "GeM, tender supply, PSU & municipal bodies, educational institutions.",
    benefits: ["GeM-ready catalog", "BIS-compliant products", "Tender documentation"],
    eligibility: ["Government / PSU / registered institution"],
    faqs: [],
    fields: ["business_name"],
  },
  architect: {
    title: "Architect & Interior Designer Program",
    blurb: "Spec-in program with samples, catalogs, and dedicated project support.",
    benefits: ["Free samples", "Project pricing", "Priority consultations"],
    eligibility: ["Practicing architect / interior designer"],
    faqs: [],
    fields: ["business_name", "years_in_business"],
  },
  contractor: {
    title: "Electrical Contractor Program",
    blurb: "Project pricing, technical support, and priority dispatch for electrical contractors.",
    benefits: ["Project pricing", "Site delivery", "Warranty support"],
    eligibility: ["Licensed electrical contractor"],
    faqs: [],
    fields: ["business_name", "years_in_business"],
  },
  oem: {
    title: "OEM Partnership",
    blurb: "White-label lighting manufactured to your specs, with your brand & packaging.",
    benefits: ["Custom branding", "MOQ-friendly runs", "BIS-compliant manufacturing"],
    eligibility: ["Company GST + CIN"],
    faqs: [],
    fields: ["business_name", "gstin", "cin", "monthly_purchase_volume"],
  },
  builder: {
    title: "Builder & Developer Partnership",
    blurb: "Turnkey lighting supply for residential and commercial real-estate projects.",
    benefits: ["Project pricing", "Bulk warranty", "Site-based dispatch"],
    eligibility: ["RERA-registered builder / developer"],
    faqs: [],
    fields: ["business_name", "gstin", "expected_monthly_purchase"],
  },
  career: {
    title: "Career With Aurona",
    blurb: "Join a fast-growing lighting brand — sales, product design, operations, and more.",
    benefits: ["Competitive pay", "Growth opportunities", "Health benefits"],
    eligibility: ["Open positions across India"],
    faqs: [],
    fields: [],
  },
};

export const Route = createFileRoute("/partner/$type")({
  loader: ({ params }) => {
    if (!(params.type in PROGRAMS)) throw notFound();
  },
  head: ({ params }) => {
    const p = PROGRAMS[params.type as PartnerType];
    if (!p) return {};
    return {
      meta: [
        { title: `${p.title} — Aurona` },
        { name: "description", content: p.blurb },
        { property: "og:title", content: p.title },
        { property: "og:description", content: p.blurb },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="container-x py-24 text-center">
      <h1 className="text-display text-3xl">Program not found</h1>
      <Button asChild className="mt-6">
        <Link to="/partner">See all programs</Link>
      </Button>
    </div>
  ),
  component: PartnerProgram,
});

function PartnerProgram() {
  const { type } = Route.useParams();
  const program = PROGRAMS[type as PartnerType];

  return (
    <div className="container-x py-12">
      <div className="mb-6 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>{" "}
        /{" "}
        <Link to="/partner" className="hover:text-foreground">
          Partner
        </Link>{" "}
        / <span className="text-foreground">{program.title}</span>
      </div>

      <div className="mx-auto max-w-5xl">
        <div>
          <div className="text-eyebrow text-gold">Partner Program</div>
          <h1 className="text-display mt-3 text-4xl">{program.title}</h1>
          <p className="mt-4 text-base text-muted-foreground">{program.blurb}</p>

          <div className="mt-8">
            <div className="text-eyebrow">Benefits</div>
            <ul className="mt-3 space-y-2 text-sm">
              {program.benefits.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  {b}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8">
            <div className="text-eyebrow">Eligibility</div>
            <ul className="mt-3 space-y-2 text-sm">
              {program.eligibility.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  {b}
                </li>
              ))}
            </ul>
          </div>

          {program.faqs.length > 0 && (
            <div className="mt-8">
              <div className="text-eyebrow">FAQs</div>
              <div className="mt-3 space-y-4">
                {program.faqs.map((f) => (
                  <div key={f.q}>
                    <div className="text-sm font-semibold">{f.q}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{f.a}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="mt-10 rounded-xl border border-border bg-card p-6 text-center sm:p-8">
          <div className="text-eyebrow text-gold">Interested?</div>
          <h2 className="text-display mt-2 text-2xl">Apply from the Careers page</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
            This page is for program details only. Use the Apply Now button on the Careers page to submit your
            application.
          </p>
          <Button asChild size="lg" className="mt-6 rounded-full px-10">
            <a href={`/careers?applyTitle=${encodeURIComponent(program.title)}`}>Apply Now</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
